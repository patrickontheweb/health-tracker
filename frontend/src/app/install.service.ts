import {Injectable,signal} from '@angular/core';
interface InstallPrompt extends Event {prompt():Promise<void>;userChoice:Promise<{outcome:string}>;}
@Injectable({providedIn:'root'})
export class InstallService {
  private promptEvent:InstallPrompt|null=null;
  available=signal(false);
  installed=signal(matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator & {standalone?:boolean}).standalone));
  instructions=signal(false);
  constructor(){
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();this.promptEvent=event as InstallPrompt;this.available.set(true);});
    window.addEventListener('appinstalled',()=>{this.installed.set(true);this.available.set(false);this.promptEvent=null;this.instructions.set(false);});
  }
  async install(){
    const event=this.promptEvent;
    if(!event){this.instructions.set(!this.instructions());return;}
    this.promptEvent=null;this.available.set(false);await event.prompt();await event.userChoice;
  }
}
