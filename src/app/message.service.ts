import { Injectable } from '@angular/core';
import { Message } from './classes/message';

@Injectable({
  providedIn: 'root',
})
export class MessageService {
  messages: Message[] = [];

  add(message: Message) {
    this.messages.push(message);
  }

  set(message: Message) {
    this.messages = [message];
  }

  remove(message: Message) {
    this.messages.splice(this.messages.indexOf(message), 1);
  }

  clear() {
    this.messages = [];
  }
}
