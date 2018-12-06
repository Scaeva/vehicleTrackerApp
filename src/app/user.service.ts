import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer, Subject } from 'rxjs';
import { catchError, map, shareReplay, switchMap, takeUntil } from 'rxjs/operators';
import { User } from './classes/user';
import { Vehicle } from './classes/vehicle';
import { LocalStorage } from '@ngx-pwa/local-storage';

class ListResponse {
  data: UserResponse[];
}

class UserResponse {
  userid: number;
  owner: OwnerResponse;
  vehicles: VehicleResponse[];
}

class OwnerResponse {
  name: string;
  surname: string;
  foto: string;
}

class VehicleResponse {
  vehicleid: number;
  make: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  foto: string;
}

class GetLocationsResponse {
  data: VehicleLocationResponse[];
}

class VehicleLocationResponse {
  vehicleid: number;
  lat: number;
  lon: number;
}

class GetAddressResponse {
  display_name: string;
}

const USERS_CACHE: number = 300000;
const LOCATION_CACHE: number = 30000;
const LOCATION_RELOAD: number = 60000;

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersUrl = 'http://mobi.connectedcar360.net/api/?op=list';
  private locationsUrl = 'http://mobi.connectedcar360.net/api/?op=getlocations&userid=';
  private locationsAddressCache: { [lat: number]: { [lon: number]: Observable<string> } } = {};
  private stopLocationReloading$ = new Subject<void>();

  constructor(private http: HttpClient, private localStorage: LocalStorage) { }

  private requestUsers(): Observable<User[]> {
    //console.log(new Date().toISOString(), "UserService.requestUsers");
    return this.http.get<ListResponse>(this.usersUrl)
      .pipe(
        map(res => {
          return res.data.filter(d => d.userid).map(d => {
            let user = new User();
            user.id = d.userid;
            user.name = d.owner.name;
            user.surname = d.owner.surname;
            user.photo = d.owner.foto;
            user.vehicles = d.vehicles.map(v => {
              let vehicle = new Vehicle();
              vehicle.id = v.vehicleid;
              vehicle.make = v.make;
              vehicle.model = v.model;
              vehicle.year = v.year;
              vehicle.color = v.color;
              vehicle.vin = v.vin;
              vehicle.photo = v.foto;
              return vehicle;
            });
            return user;
          });
        }),
        catchError(this.handleError('getUsers', []))
      );
  }

  regetUsers(): Observable<User[]> {
    //console.log(new Date().toISOString(), "UserService.regetUsers");
    return this.localStorage.removeItem("users_expires").pipe(switchMap(() => {
      return this.requestUsers().pipe(
        (map(users => {
          this.localStorage.setItem("users", users).subscribe(() => { });
          this.localStorage.setItem("users_expires", +new Date() + USERS_CACHE).subscribe(() => { });
          return users;
        }))
      );
    }));
  }

  getUsers(force?: boolean): Observable<User[]> {
    //console.log(new Date().toISOString(), `UserService.getUsers(${force})`);
    return force && this.regetUsers() || this.localStorage.getItem<number>("users_expires").pipe(
      switchMap((date: number) => {
        //console.log(new Date().toISOString(), "users_expires switchMap", date);
        if (date === null || date < +new Date()) {
          return this.regetUsers();
        }
        return this.localStorage.getUnsafeItem<User[]>("users").pipe(
          switchMap((users: User[]) => {
            //console.log(new Date().toISOString(), "users switchMap", users);
            if (users === null) {
              return this.regetUsers();
            }
            return of(users);
          })
        );
      }));
  }

  getUser(id: number, force?: boolean): Observable<User> {
    //console.log(new Date().toISOString(), `UserService.getUser(${id}, ${force})`);
    return this.getUsers(force).pipe(
      map(users => users.find(user => user.id === id))
    );
  }

  requestLocation(userId: number): Observable<VehicleLocationResponse[]> {
    //console.log(new Date().toISOString(), `UserService.requestLocation(${userId})`);
    return this.http.get<GetLocationsResponse>(this.locationsUrl + userId)
      .pipe(
        map(res => res.data),
        catchError(this.handleError('requestLocation', []))
      );
  }

  regetLocation(userId: number): Observable<VehicleLocationResponse[]> {
    //console.log(new Date().toISOString(), `UserService.regetLocation(${userId})`);
    return this.localStorage.removeItem(`user_${userId}_locations_expires`).pipe(switchMap(() => {
      return this.requestLocation(userId).pipe(
        (map(users => {
          this.localStorage.setItem(`user_${userId}_locations`, users).subscribe(() => { });
          this.localStorage.setItem(`user_${userId}_locations_expires`, +new Date() + LOCATION_CACHE).subscribe(() => { });
          return users;
        }))
      );
    }));
  }

  getLocationsFromLocalStorage(userId: number, force?: boolean): Observable<VehicleLocationResponse[]> {
    //console.log(new Date().toISOString(), `UserService.getLocationsFromLocalStorage(${userId})`);
    return force && this.regetLocation(userId) || this.localStorage.getItem<number>(`user_${userId}_locations_expires`).pipe(
      switchMap((date: number) => {
        //console.log(new Date().toISOString(), `user_${userId}_locations_expires.switchMap`, date);
        if (date === null || date < +new Date()) {
          return this.regetLocation(userId);
        }
        return this.localStorage.getUnsafeItem<VehicleLocationResponse[]>(`user_${userId}_locations`).pipe(
          switchMap((locations: VehicleLocationResponse[]) => {
            //console.log(new Date().toISOString(), `user_${userId}_locations.switchMap`, locations);
            if (locations === null) {
              return this.regetLocation(userId);
            }
            return of(locations);
          })
        );
      })
    );
  }

  getLocationsWithReloads(userId: number, force?: boolean): Observable<VehicleLocationResponse[]> {
    //console.log(new Date().toISOString(), `UserService.getLocationsWithReloads(${userId}, ${force})`);
    this.stopLocationReloading();
    const timer$ = timer(0, LOCATION_RELOAD);
    return timer$.pipe(
      switchMap(_ => this.getLocationsFromLocalStorage(userId, force)),
      takeUntil(this.stopLocationReloading$),
      shareReplay(1)
    );
  }

  stopLocationReloading() {
    //console.log(new Date().toISOString(), 'UserService.stopLocationReloading');
    this.stopLocationReloading$.next();
  }

  getAddress(lat: number, lon: number): Observable<string> {
    //console.log(new Date().toISOString(), `UserService.getAddress(${lat}, ${lon})`);
    let latDict = this.locationsAddressCache[lat];
    if (latDict) {
      let lonDict = latDict[lon];
      if (lonDict) {
        //console.log(new Date().toISOString(), "from dict");
        return lonDict;
      }
    } else {
      latDict = {};
      this.locationsAddressCache[lat] = latDict;
    }
    //console.log(new Date().toISOString(), "from api");
    latDict[lon] = this.http.get<GetAddressResponse>(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=0&accept-language=en-US,en`)
      .pipe(
        map(res => res.display_name
        ),
        catchError(this.handleError('getAddress', ''))
      );
    return latDict[lon];
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(operation, error);
      return of(result as T);
    };
  }
}
