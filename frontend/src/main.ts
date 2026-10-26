import {isDevMode} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {provideHttpClient} from '@angular/common/http';
import {AuthService} from './app/auth.service';
import {AppComponent} from './app/app.component';
import {ConfigService} from './app/config.service';
import {provideAppInitializer,inject} from '@angular/core';
bootstrapApplication(AppComponent,{providers:[provideHttpClient(),provideAppInitializer(()=>{const config=inject(ConfigService),auth=inject(AuthService);return config.load().then(()=>auth.restore());})]}).then(()=>{if(!isDevMode()&&'serviceWorker' in navigator)void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});}).catch(console.error);
