"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AVATAR_OPTIONS, avatarOption, avatarSource } from "@/lib/avatars";

export function AvatarImage({value,size=40,className=""}:{value:string;size?:number;className?:string}) {
  return <img className={`illustrated-avatar ${className}`} src={avatarSource(value)} width={size} height={size} alt="" draggable={false}/>;
}
export function AvatarPicker({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const [carousel,setCarousel]=useState<CarouselApi>();
  const selected=avatarOption(value);
  return <section className="avatar-picker" aria-label="Escolha seu avatar">
    <div className="avatar-picker-heading"><b>Escolha seu avatar</b><span>Arraste para ver mais</span></div>
    <Carousel className="avatar-carousel" opts={{align:"start",dragFree:true,containScroll:"trimSnaps"}} setApi={setCarousel} onKeyDownCapture={undefined} aria-label="Avatares ilustrados">
      <RadioGroup value={selected.id} onValueChange={onChange} orientation="horizontal" className="avatar-radio-group" aria-label="Escolha seu avatar">
        <CarouselContent className="avatar-carousel-track">{AVATAR_OPTIONS.map((option,index)=><CarouselItem className="avatar-carousel-item" key={option.id}>
          <label className={`avatar-choice ${selected.id===option.id?"avatar-selected":""}`}>
            <RadioGroupItem className="sr-only" value={option.id} aria-label={`Avatar ${option.name}`} onFocus={()=>carousel?.scrollTo(index)}/>
            <AvatarImage value={option.id} size={76}/><span className="avatar-name">{option.name}</span>{selected.id===option.id&&<Check className="avatar-check" size={17}/>}</label>
        </CarouselItem>)}</CarouselContent>
      </RadioGroup>
      <div className="avatar-carousel-navigation"><span>{selected.name} selecionado</span><div><CarouselPrevious className="avatar-carousel-button" aria-label="Avatares anteriores"/><CarouselNext className="avatar-carousel-button" aria-label="Mais avatares"/></div></div>
    </Carousel>
    <small className="avatar-credit">Avatares <a href="https://www.dicebear.com/styles/adventurer/" target="_blank" rel="noreferrer">Adventurer · Lisa Wischofsky / DiceBear</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></small>
  </section>;
}
