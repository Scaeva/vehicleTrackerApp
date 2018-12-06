import { Component, OnInit, OnDestroy } from '@angular/core';
import { User } from '../classes/user';
import { UserService } from '../user.service';
import { MessageService } from '../message.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit, OnDestroy {
  users: User[];
  private subscriber: Subscription;

  constructor(private userService: UserService, private messageService: MessageService) { }

  ngOnInit() {
    this.getUsers();
  }

  ngOnDestroy():void {
    this.subscriberUnsubscribe();
  }

  private getUsers(force?: boolean): void {
    this.subscriberUnsubscribe();
    this.userService.getUsers(force).subscribe(users => {
      this.users = users;
      if (!this.users.length) {
        this.messageService.set({ text: 'No users returned from service.', callback: () => { this.getUsers(true); } });
      }
    });
  }

  private subscriberUnsubscribe(): void {
    this.subscriber && this.subscriber.unsubscribe();
  }
}
