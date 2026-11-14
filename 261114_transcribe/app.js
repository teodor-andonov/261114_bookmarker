import {formatClock, formatBytes, sanitizeSegments, makeSrt, safeDownloadStem} from './transcript-utils.js';

const $ = id => document.getElementById(id);
const els = {
  fileInput: $('fileInput'), drop: $('dropZone'), fileDetails: $('fileDetails'), fileName: $('fileName'),
  fileMeta: $('fileMeta'), remove: $('removeFile'), player: $('audioPlayer'),
  record: $('recordButton'), recordLabel: $('recordLabel'), recordTime: $('recordTime'),
  model: $('modelSelect'), language: $('languageSelect'), device: $('deviceSelect'),
  start: $('transcribeButton'), startLabel: $('transcribeLabel'), cancel: $('cancelButton'),
  status: $('statusText'), percent: $('statusPercent'), fill: $('progressFill'),
  transcript: $('transcript'), resultState: $('resultState'), segments: $('segments'), segmentCount: $('segmentCount'),
  copy: $('copyButton'), txt: $('txtButton'), srt: $('srtButton')
};
const MAX_FILE_BYTES = 150_000_000;
const MAX_DURATION = 15 * 60;
let selectedFile = null;
let playerURL = null;
let worker = null;
let job = 0;
let busy = false;
let recording = null;
let mediaStream = null;
let recordedChunks = [];
let clockInterval = null;
let transcriptSegments = [];

function status(message, percent = null, error = false) {
  els.status.textContent = message;
  els.status.style.color = error ? '#f1a9a9' : '';
  if (percent != null) {
    els.fill.style.width = `${Math.min(100, Math.max(0,percent))}%`;
    els.percent.textContent = percent > 0 ? `${Math.round(percent)}%` : '';
  }
}
function setBusy(value) {
  busy = value;
  els.start.disabled = value || !selectedFile;
  els.cancel.hidden = !value;
  els.drop.setAttribute('aria-disabled', String(value));
  els.fileInput.disabled = value;
  els.remove.disabled = value;
  els.record.disabled = value;
  els.model.disabled = value;
  els.language.disabled = value || els.model.value === 'english';
  els.device.disabled = value;
  els.startLabel.textContent = value ? 'Transcribing…' : 'Transcribe audio';
}
function clearResults() {
  transcriptSegments = [];
  els.transcript.value = '';
  els.transcript.disabled = true;
  els.resultState.textContent = 'EMPTY';
  els.resultState.classList.remove('done');
  els.copy.disabled = true;
  els.txt.disabled = true;
  els.srt.disabled = true;
  els.segmentCount.textContent = '—';
  els.segments.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'segments-placeholder';
  empty.textContent = 'Time-linked phrases will appear after transcription. Tap a timestamp to seek in the audio.';
  els.segments.append(empty);
}
function selectAudio(file) {
  if (busy || recording?.state === 'recording') return;
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) { status('File exceeds 150 MB. Choose a smaller recording.',0,true); return; }
  if (file.size === 0) { status('This audio file is empty.',0,true); return; }
  if (playerURL) URL.revokeObjectURL(playerURL);
  selectedFile = file;
  playerURL = URL.createObjectURL(file);
  els.player.src = playerURL;
  els.fileName.textContent = file.name;
  els.fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || 'audio file'}`;
  els.fileDetails.hidden = false;
  clearResults();
  status('Ready to transcribe',0);
  setBusy(false);
}
function removeAudio() {
  if (busy) return;
  if (playerURL) URL.revokeObjectURL(playerURL);
  selectedFile = null;
  playerURL = null;
  els.player.removeAttribute('src');
  els.player.load();
  els.fileDetails.hidden = true;
  els.fileInput.value = '';
  clearResults();
  setBusy(false);
  status('Choose a file to begin',0);
}
els.drop.addEventListener('click', () => { if (!busy) els.fileInput.click(); });
els.drop.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) {e.preventDefault(); els.fileInput.click();} });
els.fileInput.addEventListener('change', () => {selectAudio(els.fileInput.files?.[0]); els.fileInput.value='';});
for (const event of ['dragenter','dragover']) els.drop.addEventListener(event, e => {e.preventDefault(); if(!busy)els.drop.classList.add('dragging');});
for (const event of ['dragleave','drop']) els.drop.addEventListener(event, e => {e.preventDefault(); els.drop.classList.remove('dragging');});
els.drop.addEventListener('drop', e => { if (!busy) selectAudio([...e.dataTransfer.files].find(Boolean)); });
els.remove.addEventListener('click', removeAudio);
els.model.addEventListener('change', () => {
  if (els.model.value === 'english') els.language.value = 'english';
  els.language.disabled = els.model.value === 'english';
});

function stopMediaTracks() {
  mediaStream?.getTracks().forEach(track => track.stop());
  mediaStream = null;
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = null;
  els.record.closest('.record-row').classList.remove('recording');
  els.recordLabel.textContent = 'Record microphone';
}
els.record.addEventListener('click', async () => {
  if (busy) return;
  if (recording?.state === 'recording') {recording.stop();return;}
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {status('Microphone recording is not supported in this browser.',0,true);return;}
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({audio:true});
    const mime = ['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(x => MediaRecorder.isTypeSupported(x));
    recording = mime ? new MediaRecorder(mediaStream,{mimeType:mime}) : new MediaRecorder(mediaStream);
    recordedChunks=[];
    recording.addEventListener('dataavailable',e=>{if(e.data?.size)recordedChunks.push(e.data);});
    recording.addEventListener('stop',()=>{
      const type = recording.mimeType || mime || 'audio/webm';
      const extension = type.includes('mp4') ? 'm4a' : 'webm';
      const blob = new Blob(recordedChunks,{type});
      stopMediaTracks();
      recording = null;
      els.start.disabled = !selectedFile;
      els.recordTime.textContent='';
      if(blob.size)selectAudio(new File([blob],`recording-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`,{type}));
    },{once:true});
    recording.start(250);
    els.record.closest('.record-row').classList.add('recording');
    els.recordLabel.textContent='Stop recording';
    els.start.disabled = true;
    const started=Date.now();
    const tick=()=>{els.recordTime.textContent=formatClock((Date.now()-started)/1000);};
    tick();clockInterval=setInterval(tick,500);
    status('Recording on your device…',0);
  } catch(err) {stopMediaTracks();status(`Microphone unavailable: ${err.message || err}`,0,true);}
});
window.addEventListener('pagehide',()=>{if(recording?.state==='recording')recording.stop();stopMediaTracks();});

async function decodeMono(file) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor || !window.OfflineAudioContext) throw new Error('This browser lacks the audio decoder needed for local transcription.');
  let context;
  try {
    context = new AudioCtor();
    const input = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(input);
    if (!decoded.length || decoded.duration <= 0) throw new Error('Audio contains no samples.');
    if (decoded.duration > MAX_DURATION) throw new Error('Prototype limit: 15 minutes per recording. Split longer files before transcription.');
    const count = Math.max(1,Math.ceil(decoded.duration * 16000));
    const offline = new OfflineAudioContext(1,count,16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const mono = await offline.startRendering();
    return {audio: mono.getChannelData(0).slice(), duration: decoded.duration};
  } catch (error) {
    if (error.name === 'EncodingError' || error.name === 'NotSupportedError') throw new Error('Cannot decode this file in your browser. Try WAV, MP3 or M4A.');
    throw error;
  } finally {if (context) await context.close().catch(()=>{});}
}
function getWorker() {
  if (worker) return worker;
  worker = new Worker('./transcriber.worker.js',{type:'module'});
  worker.addEventListener('message',onWorkerMessage);
  worker.addEventListener('error',e=>{if(busy){status(`Speech engine could not start: ${e.message || 'worker error'}`,0,true);setBusy(false);}worker?.terminate();worker=null;});
  return worker;
}
function renderSegments(chunks) {
  transcriptSegments = sanitizeSegments(chunks);
  els.segments.replaceChildren();
  els.segmentCount.textContent = transcriptSegments.length ? `${transcriptSegments.length} segments` : 'No timestamps';
  if (!transcriptSegments.length) {
    const p=document.createElement('p');p.className='segments-placeholder';p.textContent='The model did not return timed segments for this recording.';els.segments.append(p);return;
  }
  for(const chunk of transcriptSegments) {
    const row=document.createElement('div');row.className='segment';
    const time=document.createElement('button');time.type='button';time.textContent=formatClock(chunk.start);time.title='Play audio from this timestamp';
    time.addEventListener('click',()=>{els.player.currentTime=chunk.start;els.player.play().catch(()=>{});});
    const text=document.createElement('span');text.textContent=chunk.text;
    row.append(time,text);els.segments.append(row);
  }
}
function onWorkerMessage(event) {
  const d=event.data;
  if (!d || d.jobId !== job || !busy) return;
  if (d.type === 'download') {
    status(`Downloading speech model${d.file ? ` · ${d.file.split('/').at(-1)}` : ''}`,Math.min(65,Math.max(8,Math.round((d.percent || 0) * .6))));
  } else if (d.type === 'status') {
    const estimate = /recognis/i.test(d.message) ? 72 : 18;
    status(d.message,estimate);
  } else if (d.type === 'notice') {
    status(d.message,35);
  } else if (d.type === 'result') {
    const text=(d.text || '').trim();
    els.transcript.value=text;
    els.transcript.disabled=false;
    els.resultState.textContent=text ? 'COMPLETE' : 'NO SPEECH';
    els.resultState.classList.toggle('done',Boolean(text));
    els.copy.disabled=!text;
    els.txt.disabled=!text;
    renderSegments(d.chunks);
    els.srt.disabled=!transcriptSegments.length;
    status(text ? `Transcription complete · ${d.device === 'webgpu' ? 'GPU' : 'CPU'}` : 'Finished, but no speech was detected.',100);
    setBusy(false);
  } else if (d.type === 'error') {
    status(`Transcription failed: ${d.message}`,0,true);
    setBusy(false);
  }
}
els.start.addEventListener('click',async()=>{
  if(!selectedFile || busy)return;
  const file=selectedFile;
  const current=++job;
  clearResults();setBusy(true);status('Decoding and resampling audio locally…',5);
  try {
    const {audio,duration}=await decodeMono(file);
    if(current!==job)return;
    els.fileMeta.textContent=`${formatBytes(file.size)} · ${formatClock(duration)} · ${file.type || 'audio'}`;
    status('Loading speech engine…',10);
    const data=audio.buffer;
    getWorker().postMessage({type:'transcribe',jobId:current,audio:data,modelKey:els.model.value,language:els.language.value,device:els.device.value},[data]);
  }catch(error){if(current===job){setBusy(false);status(error.message || String(error),0,true);}}
});
els.cancel.addEventListener('click',()=>{if(!busy)return;++job;if(worker){worker.terminate();worker=null;}setBusy(false);status('Cancelled. Audio remains available.',0);});

function downloadText(text,extension,mime) {
  const blob=new Blob([text],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`${safeDownloadStem(selectedFile?.name)}.${extension}`;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
els.transcript.addEventListener('input',()=>{const hasText=Boolean(els.transcript.value.trim());els.copy.disabled=!hasText;els.txt.disabled=!hasText;});
els.copy.addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(els.transcript.value);const old=els.copy.textContent;els.copy.textContent='Copied';setTimeout(()=>{els.copy.textContent=old;},1300);}
  catch {els.transcript.focus();els.transcript.select();document.execCommand('copy');}
});
els.txt.addEventListener('click',()=>downloadText(els.transcript.value.trim()+'\n','txt','text/plain;charset=utf-8'));
els.srt.addEventListener('click',()=>downloadText(makeSrt(transcriptSegments),'srt','text/plain;charset=utf-8'));
setBusy(false);
