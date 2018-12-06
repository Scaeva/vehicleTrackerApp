import { Component, OnInit } from '@angular/core';
import { MessageService } from '../message.service';
import { Message } from '../classes/message';
import { Subscription } from 'rxjs';
import { Router, NavigationStart } from '@angular/router';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit {
  private subscriber: Subscription;

  constructor(public messageService: MessageService, private router: Router) { }

  ngOnDestroy() {
    this.subscriber.unsubscribe();
  }

  ngOnInit() {
    this.subscriber = this.router.events.subscribe((val) => val instanceof NavigationStart && this.messageService.clear());
  }

  retry(message: Message): void {
    this.messageService.remove(message);
    message.callback();
  }

}
