const opening = document.querySelector('.opening');
const hero = opening.querySelector('.hero');
const header = document.querySelector('header');
const button = hero.querySelector('.motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const layers = ['.orbit-back', '.orbit-front'].map(selector => hero.querySelector(selector).getContext('2d'));
const surface = hero.querySelector('.earth-live');
const earth = surface.getContext('2d');
const phrase = 'IMPACT POINT · ';
const tau = 2 * Math.PI;

let width, height, radius, frame, previousTime, lastGlobeFrame = 0;
let stopped = false, visible = true, longitude = 104 / 360;
let lastRingAngle = NaN, surfacePixels, samples, map;
let idleAngle = 0, breathPhase = 0, hoverStrength = 0;
let hovering = false, lightX = .5, lightY = .5, targetX = .5, targetY = .5;
const globe = hero.querySelector('.earth');
const idlePeriod = 240000;
const scrollAngle = tau / 5;
let mapWidth, mapHeight;

function prepareSphere() {
  const size = Math.min(600, Math.ceil(surface.clientWidth * Math.min(devicePixelRatio, 2)));
  if (!size || (size === surface.width && samples)) return;
  surface.width = surface.height = size;
  surfacePixels = earth.createImageData(size, size);
  samples = [];
  const latitude = 9 * Math.PI / 180;
  // Invert the orthographic projection once. Rotation is a longitude offset.
  for (let row = 0; row < size; row++) {
    const y = 1 - 2 * (row + .5) / size;
    for (let col = 0; col < size; col++) {
      const x = 2 * (col + .5) / size - 1;
      const depth = 1 - x*x - y*y;
      if (depth < 0) continue;
      const z = Math.sqrt(depth);
      const u = .5 + Math.atan2(x, z*Math.cos(latitude)-y*Math.sin(latitude)) / tau;
      const v = .5 - Math.asin(y*Math.cos(latitude)+z*Math.sin(latitude)) / Math.PI;
      samples.push(4*(row*size+col), Math.floor(u*mapWidth),
        Math.min(mapHeight-1, Math.floor(v*mapHeight))*mapWidth,
        .79+.21*Math.max(0,-.32*x+.42*y+.84*z));
    }
  }
  samples = Float32Array.from(samples);
}
function drawEarth() {
  if (!map || !samples) return;
  const pixels = surfacePixels.data;
  const offset = Math.round(longitude*mapWidth);
  for (let j = 0; j < samples.length; j += 4) {
    const dest = samples[j];
    const src = 4*(samples[j+2] + (samples[j+1]+offset)%mapWidth);
    const shade = samples[j+3];
    pixels[dest] = map[src]*shade;
    pixels[dest+1] = map[src+1]*shade;
    pixels[dest+2] = map[src+2]*shade;
    pixels[dest+3] = 255;
  }
  earth.putImageData(surfacePixels, 0, 0);
}
function drawRing(rotation) {
  for (const ctx of layers) ctx.clearRect(0,0,width,height);
  const repeat = 3;
  const fontSize = radius*.40;
  const font = '900 '+fontSize+'px "Arial Black", Arial, sans-serif';
  layers[0].font = font;
  const widths = [...phrase].map(c => layers[0].measureText(c).width);
  const phraseWidth = widths.reduce((a,b) => a+b);
  const anglePerPixel = tau/(repeat*phraseWidth);
  // Phase zero centres the first IMPACT POINT on the near side.
  let angle = -.5*(phraseWidth-widths.slice(-3).reduce((a,b)=>a+b))*anglePerPixel - rotation;
  for (let copy = 0; copy < repeat; copy++) {
    for (let i = 0; i < phrase.length; i++) {
      const step = widths[i]*anglePerPixel;
      const t = angle+step/2;
      const depth = Math.cos(t);
      const ctx = layers[depth >= 0 ? 1 : 0];
      ctx.save();
      ctx.translate(width/2,height/2);
      ctx.rotate(-.37);
      ctx.translate(radius*Math.sin(t),radius*.28*depth);
      ctx.transform(radius*anglePerPixel*depth,-radius*.28*anglePerPixel*Math.sin(t),0,1,0,0);
      ctx.font = font;
      ctx.fillStyle = '#151512';
      ctx.textAlign = 'center';
      ctx.fillText(phrase[i],0,fontSize*.35);
      ctx.restore();
      angle += step;
    }
  }
}
function render(time) {
  const travel = opening.offsetHeight - hero.offsetHeight;
  const progress = reduced.matches || travel <= 0 ? 0 :
    Math.max(0,Math.min(1,-opening.getBoundingClientRect().top/travel));
const dt = Math.min(time-(previousTime ?? time),80);
if (!stopped && !reduced.matches) {
  idleAngle = (idleAngle + tau*dt/idlePeriod)%tau;
  const ease = 1-Math.exp(-dt/320);
  hoverStrength += ((hovering ? 1 : 0)-hoverStrength)*ease;
  lightX += (targetX-lightX)*ease;
  lightY += (targetY-lightY)*ease;
  breathPhase = (breathPhase + tau*dt/5200)%tau;
  globe.style.transform = 'scale('+(1+hoverStrength*(.015-.009*Math.cos(breathPhase)))+')';
  globe.style.setProperty('--glow',hoverStrength*.20);
  globe.style.setProperty('--light-x',(lightX*100)+'%');
  globe.style.setProperty('--light-y',(lightY*100)+'%');
}
const rotation = reduced.matches ? 0 : idleAngle + progress*scrollAngle;
if (rotation !== lastRingAngle) { drawRing(rotation); lastRingAngle = rotation; }
  if (!stopped && !reduced.matches && map) {
    longitude = (longitude + Math.min(time-(previousTime ?? time),80)/150000)%1;
    if (time-lastGlobeFrame > 40) { drawEarth(); lastGlobeFrame = time; }
  }
  previousTime = time;
  frame = null;
  if (visible && !document.hidden && !stopped && !reduced.matches) frame = requestAnimationFrame(render);
}
function schedule() {
  if (frame == null && visible && !document.hidden) frame = requestAnimationFrame(render);
}
function resize() {
  opening.style.setProperty('--header-height', header.offsetHeight+'px');
  width = hero.clientWidth;
  height = hero.clientHeight;
  radius = Math.min(width*.47,height*.66);
  const scale = Math.min(devicePixelRatio,2);
  for (const ctx of layers) {
    ctx.canvas.width = Math.round(width*scale);
    ctx.canvas.height = Math.round(height*scale);
    ctx.setTransform(scale,0,0,scale,0,0);
  }
  if (map) { prepareSphere(); drawEarth(); }
  lastRingAngle = NaN;
  schedule();
}
function pointAtGlobe(event) {
  if (reduced.matches || stopped) return;
  const rect = globe.getBoundingClientRect();
  targetX = (event.clientX-rect.left)/rect.width;
  targetY = (event.clientY-rect.top)/rect.height;
  hovering = Math.hypot(targetX-.5,targetY-.5) <= .5;
}
globe.addEventListener('pointerenter',pointAtGlobe);
globe.addEventListener('pointermove',pointAtGlobe);
globe.addEventListener('pointerdown',pointAtGlobe);
for (const type of ['pointerleave','pointercancel','pointerup']) {
  globe.addEventListener(type, event => {
    if (type !== 'pointerup' || event.pointerType === 'touch') hovering = false;
  });
}
button.addEventListener('click', () => {
  stopped = !stopped;
  button.textContent = stopped ? 'Resume rotation' : 'Pause rotation';
  previousTime = undefined;
  schedule();
});
reduced.addEventListener('change', () => { button.hidden = reduced.matches; hovering = false; hoverStrength = 0; globe.style.transform = ""; globe.style.removeProperty("--glow"); resize(); });
window.addEventListener('scroll',schedule,{passive:true});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; previousTime = undefined; schedule(); }).observe(hero);
document.addEventListener('visibilitychange', () => { previousTime = undefined; schedule(); });
opening.classList.add('ready');
button.hidden = reduced.matches;
const observer = new ResizeObserver(resize);
observer.observe(header);
observer.observe(hero);
resize();
const texture = new Image();
texture.onload = () => {
  const source = document.createElement('canvas');
  source.width = mapWidth = texture.width;
  source.height = mapHeight = texture.height;
  const ctx = source.getContext('2d');
  ctx.drawImage(texture,0,0);
  map = ctx.getImageData(0,0,mapWidth,mapHeight).data;
  button.hidden = reduced.matches;
  resize();
};
texture.src = window.impactPointMap;
