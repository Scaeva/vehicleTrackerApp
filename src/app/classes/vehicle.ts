import { VehicleLocation } from './vehicleLocation';

export class Vehicle {
  id: number;
  make: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  photo: string;
  location: VehicleLocation;
}
