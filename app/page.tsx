'use client'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Camera, FlipHorizontal, MoonIcon, PersonStanding, SunIcon, Video, Volume2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Rings } from 'react-loader-spinner'
import { useToast } from "@/components/ui/use-toast"

import '@tensorflow/tfjs-backend-cpu'
import '@tensorflow/tfjs-backend-webgl'
import * as cocossd from '@tensorflow-models/coco-ssd'
import { ObjectDetection } from '@tensorflow-models/coco-ssd'
import { drawOnCanvas } from './utils/draw'
import { beep } from './utils/beep'
import SocialMediaLinks from '@/components/social-links'
type Props = {}

let timeout: any = null;
let interval: any = null;
const Home = (props: Props) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // state
  const [model, setModel] = useState<ObjectDetection>();
  // is loading
  const [loading, setLoading] = useState<boolean>(true);

  // TO SET UP AUTORECORD 
  // 1. add to use effect hook for state changes.. 
  // 2. check before calling record in run predictions
  // 3. button state
  // 4. button toggle
  function toggleAutoRecord() {
    if (autorecordEnabled) {
      setAutorecordEnabled(false);
      toast({ title: 'Automatic recording disabled' });
    } else {
      setAutorecordEnabled(true);
      toast({ title: 'Automatic recording enabled' });
    }
  }
  const [autorecordEnabled, setAutorecordEnabled] = useState(false);

  // setting up recording

  // 1. Refs
  // 2. state is recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  // 3. use effect hook when webcam ref loads 
  useEffect(() => {
    if (webcamRef && webcamRef.current) {
      const stream = (webcamRef.current.video as any).captureStream();
      if (stream) {
        // when stream exists 
        // set up media recorder
        // 3.1. instantiate
        // 3.2. on data available , on start, on stop
        mediaRecorderRef.current = new MediaRecorder(stream);
        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            const recordedBlob = new Blob([e.data], { type: 'video' });
            const videoUrl = URL.createObjectURL(recordedBlob);

            // blob -> url -> a -> download 
            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = `${formatDate(new Date())}.webm`;
            a.click();
          }
        }
        mediaRecorderRef.current.onstart = (e) => {
          setIsRecording(true);
        }
        mediaRecorderRef.current.onstop = (e) => {
          setIsRecording(false);
        }

      }
    }

  }, [webcamRef])

  // 5. show toast
  const { toast } = useToast()

  // 4. trigger recording on button click
  // 4.1 set up buttonstate
  function userPromptRecord() {

    if (!webcamRef.current) {
      // show camera not NotFoundBoundary. refresh prompt 
      toast({ title: 'Camera not found. Please refresh the page' });
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.requestData();
      // TODO : clear any timeout for ongoing recording
      mediaRecorderRef.current.stop();
      toast({ title: 'Recording saved to downloads' });
    } else {
      startRecording(false);
      toast({ title: 'Recording started' });
    }
  }

  // 5. startRecording handler // setting up timeout

  function startRecording(doBeep: boolean) {
    if (webcamRef.current && mediaRecorderRef.current?.state !== 'recording') {
      doBeep && beep(volume);
      mediaRecorderRef.current?.start();

      timeout = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current?.requestData();
          clearTimeout(timeout);
          mediaRecorderRef.current?.stop();
        }
      }, 30000);
    }
  }

  ////////////////////////////////////////////

  // volume state
  const [volume, setVolume] = useState(0.8)
  // 1. hook up volume button state
  // 2. slider
  // 3. add to useffect for states
  // 4. call beep with volume state

  // button states
  const [mirrored, setMirrored] = useState(false);

  // 1. init model
  async function initModel() {
    const loadedModel = await cocossd.load({
      base: 'mobilenet_v2'
    });
    setModel(loadedModel);
    // TODO: set and unset loading of the page when model loads | check for model state variable change in useeffect hook
  }
  // 2. when page loads
  useEffect(() => {
    // runs only when page loads
    setLoading(true);
    initModel();
  }, []);
  useEffect(() => {
    if (model) {
      setLoading(false);
      console.log('model loaded');
    }
  }, [model]);
  // 3. run predictions
  async function runPredictions() {
    if (model
      && webcamRef.current
      && webcamRef.current.video
      && webcamRef.current.video.readyState === 4) {
      // webcam has enough data for prediction
      const predictions = await model.detect(webcamRef.current.video);

      //resize canvas
      resizeCanvas(canvasRef, webcamRef);
      // draw on canvas
      drawOnCanvas(mirrored, predictions, canvasRef.current?.getContext('2d'));

      if (predictions?.length > 0) {
        // if person
        let person: boolean = false;
        predictions.forEach(prediction => {
          person = prediction.class === 'person'
        });
        if (person) {
          autorecordEnabled && startRecording(true);
        }
      }
    }
  }

  // 4. set 100ms interval 
  useEffect(() => {
    interval = setInterval(() => {
      runPredictions();
    }, 100);
    return () => clearInterval(interval);
  }, [webcamRef.current, model, mirrored, autorecordEnabled, volume])



  return (
    <div className="flex h-screen">
      {/* Left side - Webcam and Canvas */}
      <div className="relative">
        <div className="relative h-screen w-full">
          <Webcam
            ref={webcamRef}
            mirrored={mirrored}
            className="h-full w-full object-contain p-2"
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 h-full w-full object-contain"
          />
        </div>
      </div>

      {/* Right division - Container div */}
      <div className="flex flex-row flex-1">
        {/* Buttons container*/}
        <div className="border-primary/5 border-2 max-w-xs flex flex-col gap-2 justify-between shadow-md rounded-md p-4">
          {/* TOP*/}
          <div className='flex flex-col gap-2'>
            <ModeToggle />
            <Button variant={'outline'} size={'icon'} onClick={() => { setMirrored((prev) => !prev); }}><FlipHorizontal /></Button>
            <Separator className='my-2' />
          </div>

          {/* Middle  */}
          <div className='flex flex-col gap-2'>
            <Separator className='my-2' />
            <Button variant={'outline'} size={'icon'} onClick={userPromptScreenshot}><Camera /></Button>
            <Button variant={isRecording ? 'destructive' : 'outline'} size={'icon'} onClick={userPromptRecord}><Video /></Button>
            <Separator className='my-2' />
            <Button
              variant={autorecordEnabled ? 'destructive' : 'outline'} size={'icon'}
              onClick={toggleAutoRecord}
            >
              {autorecordEnabled ? <Rings color='white' height={45} /> : <PersonStanding />}
            </Button>
            <Separator className='my-2' />

          </div>

          {/* Bottom  */}
          <div className='flex flex-col gap-2'>
            <Separator className='my-2' />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={'outline'} size={'icon'}><Volume2 /></Button>
              </PopoverTrigger>
              <PopoverContent side='right'>
                <Slider max={1} min={0} step={0.2} defaultValue={[volume]} onValueCommit={(val) => { setVolume(val[0]); beep(val[0]) }} />
              </PopoverContent>
            </Popover>

          </div>

        </div>
        {/* Wiki section  */}
        <Separator orientation='vertical' className='mx-1' />
        <div className="h-full flex-1 py-4 px-2 overflow-y-scroll">
          <RenderFeatureHighlights />
        </div>
      </div>
      {loading &&
        <div className='z-50 absolute w-full h-full flex items-center justify-center bg-white'>
          Getting things ready . . . <Rings height={50} color='#ff0000' />
        </div>
      }
    </div >
  )

  // handler functions
  function userPromptScreenshot() {
    if (!webcamRef.current) {
      // toast camera not found. please refresh
    } else {
      // take a screenshot 
      const imgSrc = webcamRef.current.getScreenshot();
      console.log(imgSrc)
      const blob = base64toBlob(imgSrc);
      // blob to url 
      const url = URL.createObjectURL(blob);
      // url to a tag 
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formatDate(new Date())}.png`
      // download 
      a.click();
    }
  }

  // inner components
  function RenderFeatureHighlights() {
    return (
      <div className='text-xs text-muted-foreground'>
        <ul className='space-y-4'>
          <li>
            <strong>Dark Mode/Sys Theme 🌗</strong>
            <p>Toggle between dark mode and system theme.</p>
            {/* <Button className='my-2 h-6 w-6' variant={'outline'} size={'icon'} >{theme === 'dark' ? <MoonIcon size={14} /> : <SunIcon size={14} />}</Button> */}
            <Button className='my-2 h-6 w-6' variant={'outline'} size={'icon'} ><SunIcon size={14} /></Button> / <Button className='my-2 h-6 w-6' variant={'outline'} size={'icon'} ><MoonIcon size={14} /></Button>
          </li>
          <li>
            <strong>Horizontal Flip ↔️</strong>
            <p>Adjust horizontal orientation.</p>
            <Button className='h-6 w-6 my-2'
              variant={'outline'}
              size={'icon'}
              onClick={() => { setMirrored((prev) => !prev); }}>
              <FlipHorizontal size={14} />
            </Button>

          </li>
          <Separator />
          <li>
            <strong>Take Pictures 📸</strong>
            <p>Capture snapshots at any moment from the video feed.</p>
            <Button className='my-2 h-6 w-6' variant={'outline'} size={'icon'} onClick={userPromptScreenshot}><Camera size={14} /></Button>
          </li>
          <li>
            <strong>Manual Video Recording 📽️</strong>
            <p>Manually record video clips as needed.</p>
            <Button className='h-6 w-6 my-2' variant={isRecording ? 'destructive' : 'outline'} size={'icon'} onClick={userPromptRecord}><Video size={14} /></Button>
          </li>
          <Separator />
          <li>
            <strong>Enable/Disable Auto Record 🚫</strong>
            <p>Option to enable/disable automatic video recording whenever required.</p>
            <Button
              variant={autorecordEnabled ? 'destructive' : 'outline'} size={'icon'}
              onClick={toggleAutoRecord}
              className='h-6 w-6 my-2'
            >
              {autorecordEnabled ? <Rings color='white' height={30} /> : <PersonStanding size={14} />}
            </Button>
          </li>

          <li>
            <strong>Volume Slider 🔊</strong>
            <p>Adjust the volume level of the notifications.</p>
          </li>
          <li>
            <strong>Camera Feed Highlighting 🎨</strong>
            <p>Highlights persons in <span style={{ color: '#FF0F0F' }}>red</span> and other objects in <span style={{ color: '#00B612' }}>green</span>.</p>
          </li>
          <Separator />
          <li className='space-y-4'>
            <strong>Share your thoughts 💬 </strong>
            <SocialMediaLinks />
            <br />
            <br />
            <br />
          </li>
        </ul>
      </div>
    );
  }
}

export default Home




function resizeCanvas(canvasRef: React.RefObject<HTMLCanvasElement>, webcamRef: React.RefObject<Webcam>) {
  const canvas = canvasRef.current;
  const video = webcamRef.current?.video;

  if (canvas && video) {
    const { videoWidth, videoHeight } = video;

    // set canvas to video dimensions
    canvas.width = videoWidth;
    canvas.height = videoHeight;
  }
}

function base64toBlob(base64Data: any) {
  const byteCharacters = atob(base64Data.split(',')[1]);
  const arrayBuffer = new ArrayBuffer(byteCharacters.length);
  const byteArray = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([arrayBuffer], { type: 'image/png' }); // Specify the image type here
}

function formatDate(d: Date) {
  const dformat =
    [(d.getMonth() + 1).toString().padStart(2, '0'),
    d.getDate().toString().padStart(2, '0'),
    d.getFullYear()].join('-')
    + ' ' +
    [d.getHours().toString().padStart(2, '0'),
    d.getMinutes().toString().padStart(2, '0'),
    d.getSeconds().toString().padStart(2, '0')].join('-');
  return dformat;
}