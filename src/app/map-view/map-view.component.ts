import { Component, OnInit, Input, Output, OnDestroy, OnChanges, SimpleChanges, EventEmitter } from '@angular/core';
import { User } from '../classes/user';
import { Vehicle } from '../classes/vehicle';
import { VehicleLocation } from '../classes/vehicleLocation';
import { UserService } from '../user.service';
import { MessageService } from '../message.service';
import 'ol/ol.css';
import { Map, View, Feature } from 'ol';
import Point from 'ol/geom/Point';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { fromLonLat } from 'ol/proj';
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM';
import { Style, Circle, Stroke, Fill } from 'ol/style';
import Select from 'ol/interaction/Select';

@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.css']
})
export class MapViewComponent implements OnInit, OnDestroy {
  @Input() user: User;
  @Input() selectedVehicle: Vehicle;
  @Output() selectVehicle: EventEmitter<Vehicle> = new EventEmitter();
  selectedVehicleLocation: VehicleLocation;
  private map: Map;
  private view: View;
  private vectorLayer: VectorLayer;
  private vehiclesVsFeatures: {} = {};
  private coordinates: { [id: number]: VehicleLocation} = {};

  constructor(private userService: UserService, private messageService: MessageService) { }

  ngOnInit() {
    //console.log("map-view.ngOnInit", this);
    let self = this;
    if (!this.user) {
      return;
    }
    if (!this.map) {
      this.vectorLayer = new VectorLayer({
        source: new VectorSource({ features: [] })
      });

      this.view = new View({
        center: [0, 0],
        zoom: 10,
        maxZoom: 18
      });
      this.map = new Map({
        target: 'map',
        layers: [
          new TileLayer({
            preload: Infinity,
            source: new OSM()
          }),
          this.vectorLayer
        ],
        view: this.view,
        controls: []
      });

      let select = new Select();

      select.on('select', function (e) {
        let selectedVehicle = null;
        e.selected.forEach(feature => {
          selectedVehicle = self.user.vehicles.find(vehicle => vehicle.id === feature.values_.name);
        });
        self.selectVehicle.emit(selectedVehicle);
      });
      this.map.addInteraction(select);
    }

    this.vehiclesVsFeatures = {};
    let features = this.user.vehicles.map(vehicle => {
      let feature = new Feature({
        name: vehicle.id,
        geometry: new Point(fromLonLat([0, 0]))
      });
      feature.setStyle(this.featureStyle.bind(this, vehicle));
      this.vehiclesVsFeatures[vehicle.id] = feature;
      return feature;
    });

    let vectorSource = new VectorSource({
      features: features
    });
    this.vectorLayer.setSource(vectorSource);
    this.getLocations();
  }

  ngOnChanges(changes: SimpleChanges): void {
    //console.log("map-view.ngOnChanges", changes);
    if (changes && changes.selectedVehicle) {
      this.onSelectVehicle(changes.selectedVehicle.currentValue);
    }
  }

  ngOnDestroy() {
    //console.log("map-view.ngOnDestroy");
    this.userService.stopLocationReloading();
  }

  private getLocations(force?: boolean): void {
    //console.log("map-view.getLocations");
    this.userService.getLocationsWithReloads(this.user.id, force).subscribe(locations => {
      if (!locations.length) {
        this.messageService.set({ text: 'Failed to retrieve vehicles locations', callback: () => { this.getLocations(true); } })
        return;
      }
      //console.log(locations);
      locations.forEach(location => {
        let vehicleLocation = new VehicleLocation();
        vehicleLocation.lat = location.lat;
        vehicleLocation.lon = location.lon;
        this.coordinates[location.vehicleid] = vehicleLocation;
        let feature = this.vehiclesVsFeatures[location.vehicleid];
        if (!feature) return;
        feature.getGeometry().setCoordinates(fromLonLat([location.lon, location.lat]));
      });
      this.view.fit(this.vectorLayer.getSource().getExtent());
      this.onSelectVehicle(this.selectedVehicle);
    });
  }

  private panTo(lon: number, lat: number): void {
    //console.log(`map-view.panTo(${lon},${lat})`);
    this.view.animate({
      center: fromLonLat([lon, lat]),
      duration: 2000,
      zoom: 18
    });
  }

  private onSelectVehicle(vehicle: Vehicle): void {
    //console.log("map-view.onSelectVehicle", vehicle);
    if (vehicle) {
      let coordinates = this.coordinates[vehicle.id];
      if (coordinates) {
        if (!coordinates.address) {
          this.userService.getAddress(coordinates.lat, coordinates.lon).subscribe(address => {
            coordinates.address = address;
            this.selectedVehicleLocation = coordinates;
          });
        }
        this.panTo(coordinates.lon, coordinates.lat);
      }
    }
    this.vectorLayer && this.vectorLayer.changed();
  }

  private featureStyle(vehicle: Vehicle, feature: Feature, resolution: number): Style {
    let selected = this.selectedVehicle && this.selectedVehicle.id === feature.values_.name;
    return new Style({
      image: new Circle(({
        radius: selected ? 5 : 7,
        fill: new Fill({
          color: vehicle.color
        }),
        stroke: new Stroke({
          color: "#333333",
          width: selected ? 3 : 1
        })
      }))
    });
  }

  deselectVehicle(): void {
    //console.log("map-view.deselectVehicle");
    this.selectVehicle.emit(null);
  }

}
