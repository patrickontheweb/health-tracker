import {bootstrapApplication} from '@angular/platform-browser';
import {provideHttpClient} from '@angular/common/http';
import {AppComponent} from './app/app.component';
import {ConfigService} from './app/config.service';
import {provideAppInitializer,inject} from '@angular/core';
bootstrapApplication(AppComponent,{providers:[provideHttpClient(),provideAppInitializer(()=>inject(ConfigService).load())]}).catch(console.error);
