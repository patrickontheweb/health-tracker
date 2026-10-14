import {Directive,DestroyRef,ElementRef,inject} from '@angular/core';

/** Keep native number-input spinners, but reject non-digit editing and pastes. */
@Directive({selector:'input[wholeNumber]',standalone:true})
export class WholeNumberDirective {
  private input:HTMLInputElement=inject(ElementRef<HTMLInputElement>).nativeElement;
  private previous='';
  constructor(){
    const controller=new AbortController(),options={capture:true,signal:controller.signal};
    inject(DestroyRef).onDestroy(()=>controller.abort());
    const remember=()=>{if(/^\d*$/.test(this.input.value))this.previous=this.input.value;};
    this.input.addEventListener('focus',remember,options);
    this.input.addEventListener('keydown',event=>{
      remember();
      if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.length===1&&!/^\d$/.test(event.key))event.preventDefault();
    },options);
    this.input.addEventListener('beforeinput',event=>{
      remember();if(event.data!==null&&!/^\d*$/.test(event.data))event.preventDefault();
    },options);
    this.input.addEventListener('paste',event=>{
      remember();if(!/^\d*$/.test(event.clipboardData?.getData('text')??''))event.preventDefault();
    },options);
    this.input.addEventListener('drop',event=>{
      remember();if(!/^\d*$/.test(event.dataTransfer?.getData('text')??''))event.preventDefault();
    },options);
    // Covers autofill/input methods that bypass cancelable keyboard events.
    this.input.addEventListener('input',()=>{
      if(!/^\d*$/.test(this.input.value))this.input.value=this.previous;
      else remember();
    },options);
  }
}
