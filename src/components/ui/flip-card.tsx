import * as React from 'react';
import {motion,useReducedMotion,type HTMLMotionProps} from 'motion/react';
import {cn} from '@/lib/utils';
const TRANSITION={duration:0.7,ease:[0.4,0.2,0.2,1] as const};
const FACE:React.CSSProperties={transformStyle:'preserve-3d',backfaceVisibility:'hidden'};
type Direction='horizontal'|'vertical';
interface FlipCardProps extends React.HTMLAttributes<HTMLDivElement>{
 flipDirection?:Direction;initialFlipped?:boolean;flipped?:boolean;
 onFlip?:(flipped:boolean)=>void;disabled?:boolean;flipOnHover?:boolean;
}
const Context=React.createContext<{isFlipped:boolean;flipDirection:Direction}|null>(null);
function useFlipCardContext(){const context=React.useContext(Context);if(!context)throw new Error('FlipCard faces must be inside FlipCard');return context;}
const FlipCard=React.memo(React.forwardRef<HTMLDivElement,FlipCardProps>(function FlipCard({className,flipDirection='horizontal',initialFlipped=false,flipped,onFlip,disabled=false,flipOnHover=true,style,onClick,onKeyDown,onMouseEnter,onMouseLeave,children,...props},ref){
 const [internal,setInternal]=React.useState(initialFlipped);
 const isFlipped=flipped??internal;
 const change=(value:boolean)=>{if(disabled)return;if(flipped===undefined)setInternal(value);onFlip?.(value)};
 return <Context.Provider value={{isFlipped,flipDirection}}><div {...props} ref={ref} className={cn('relative border-none shadow-none',className)} style={{perspective:1000,...FACE,...style}} role="button" tabIndex={disabled?-1:0} aria-disabled={disabled||undefined} aria-pressed={isFlipped}
 onMouseEnter={e=>{onMouseEnter?.(e);if(flipOnHover)change(true)}} onMouseLeave={e=>{onMouseLeave?.(e);if(flipOnHover)change(false)}}
 onClick={e=>{if(disabled)return;onClick?.(e);if(!e.defaultPrevented)change(!isFlipped)}} onKeyDown={e=>{if(disabled)return;onKeyDown?.(e);if(!e.defaultPrevented&&(e.key==='Enter'||e.key===' ')){e.preventDefault();change(!isFlipped)}}}>{children}</div></Context.Provider>;
}));
FlipCard.displayName='FlipCard';
function makeFace(back:boolean){return React.memo(React.forwardRef<HTMLDivElement,HTMLMotionProps<'div'>>(function Face({className,style,...props},ref){
 const {isFlipped,flipDirection}=useFlipCardContext();const reduced=useReducedMotion();
 const angle=back?(isFlipped?0:180):(isFlipped?-180:0);
 return <motion.div {...props} ref={ref} className={cn('absolute inset-0 size-full',className)} aria-hidden={back?!isFlipped:isFlipped} initial={false} animate={flipDirection==='horizontal'?{rotateY:angle,rotateX:0}:{rotateX:angle,rotateY:0}} transition={reduced?{duration:0}:TRANSITION} style={{...FACE,transformStyle:'flat',...style,pointerEvents:(back?isFlipped:!isFlipped)?'auto':'none'}}/>;
}));}
const FlipCardFront=makeFace(false);FlipCardFront.displayName='FlipCardFront';
const FlipCardBack=makeFace(true);FlipCardBack.displayName='FlipCardBack';
export {FlipCard,FlipCardFront,FlipCardBack};
export type {FlipCardProps};
