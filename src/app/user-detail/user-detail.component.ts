import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { User } from '../classes/user';
import { Vehicle } from '../classes/vehicle';
import { UserService } from '../user.service';
import { MessageService } from '../message.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-user-detail',
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.css']
})

export class UserDetailComponent implements OnInit, OnDestroy {
  user: User;
  selectedVehicle: Vehicle;
  private subscriber: Subscription;
  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    //private router: Router,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.getUser();
  }

  ngOnDestroy(): void {
    this.subscriberUnsubscribe();
  }

  private subscriberUnsubscribe(): void {
    this.subscriber && this.subscriber.unsubscribe();
  }

  getUser(force?: boolean): void {
    this.subscriberUnsubscribe();
    const uid = +this.route.snapshot.paramMap.get('uid');
    const vid = +this.route.snapshot.paramMap.get('vid');
    this.subscriber = this.userService.getUser(uid, force)
      .subscribe(user => {
        this.user = user;
        this.selectedVehicle = this.user ? this.user.vehicles.find(vehicle => vehicle.id == vid) : undefined;
        if (!this.user) {
          this.messageService.set({ text: 'Failed to retrieve user', callback: () => { this.getUser(true); } });
        }
      });
  }

  onSelect(vehicle: Vehicle): void {
    this.selectedVehicle = vehicle;
    //this.router.navigate([`/users/${this.user.id}/` + (this.selectedVehicle ? `${this.selectedVehicle.id}` : '')]);
  }
}
