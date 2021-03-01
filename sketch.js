const MAX_SHAPE_SIZE = 15000;
const MIN_SHAPE_SIZE = 100;
const NUM_HARMONICS = 8;
const X_PAD = 36;
const SAMPLE_RATE = Math.pow(2, 12);
const H_OFFSET = 10;
const PLAYABLE_NOTES = "ASDFGHJK";
const COLORS = {
  CIRCLE: [80, 40, 50],
  SQUARE: [10, 50, 50],
  TRIANGLE: [50, 60, 50],
  SAWTOOTH: [30, 50, 50],
};

let canv;
let inputHeight;
let sectionHeight;
let hoveredHarmonic = -1;
let activeShape = "circle";
let activeSize = 5000;
let backgroundGraphics;
let someShapeIsHovered = false;
let activeChordRoot = 1;
let hoveredShapeIndex = -1;
let hoveredShapeButton = null;
let activeNoteIndex = 1;

let buttonPanelPos;
let buttonPanelWidth;

const oscillatorShapes = [];

const musicScale = new teoria.note("A1").scale("major");

const buttonClick = new Tone.Player("./fx_click.wav").toDestination();
buttonClick.playbackRate = 0.4;
buttonClick.volume.value = -10;
const uiBlip = new Tone.Player("./blip_hi.wav");
uiBlip.connect(new Tone.Filter({ type: "lowpass", frequency: 1000 }));
uiBlip.connect(Tone.Destination);
uiBlip.volume.value = -20;

const amplitudeEnvelope = new Tone.AmplitudeEnvelope({
  attack: 0.01,
  decay: 0.5,
  sustain: 1,
  release: 0.5,
});

const OUTPUT_NODE = new Tone.Gain(0.3);
const analyzer = new Tone.Waveform(SAMPLE_RATE);
OUTPUT_NODE.chain(amplitudeEnvelope, analyzer, Tone.Destination);

// const loop = new Tone.Loop((time) => {
//   amplitudeEnvelope.triggerAttackRelease("16n", time);
// }, "8n").start(0);

Tone.Transport.start();
amplitudeEnvelope.triggerAttack();

const dragBehaviorControls = [
  {
    getIsSelected: () => !keyIsDown(SHIFT) && !keyIsDown(ALT),
    renderLogo: () => {
      scale(1.4);
      drawCrosshair();
    },
  },
  {
    getIsSelected: () => keyIsDown(ALT),
    label: "ALT",
    renderLogo: () => {
      translate(0, -10);
      drawCrosshair();
      const tickWidth = 30;
      rectMode(CENTER);
      translate(0, 30);

      rect(0, 0, tickWidth * 2, 0);
      rect(tickWidth, 0, 2, 10);
      rect(-tickWidth, 0, 2, 10);
      for (let i = 0; i < tickWidth; i += tickWidth / 2) {
        noStroke();
        rectMode(CENTER);
        rect(i, 0, 2, 6);
        rect(-i, 0, 2, 6);
      }
    },
  },
  {
    getIsSelected: () => keyIsDown(SHIFT),
    label: "SHIFT",
    renderLogo: () => {
      drawCrosshair();
      noFill();
      canv.drawingContext.setLineDash([5, 4]);
      oscTypes.circle.renderShape(4000);
      canv.drawingContext.setLineDash([]);
    },
  },
];

const setActiveShape = (newActiveShape) => {
  buttonClick.playbackRate = 0.4;
  buttonClick.start();
  activeShape = newActiveShape;
};

const getMousePos = () =>
  createVector(constrain(mouseX, X_PAD, width - X_PAD), mouseY);

const showToolTip = (label) => {
  push();
  translate(mouseX, mouseY);
  fill(0, 0, 10, 0.8);
  rectMode(CORNER);
  noStroke();
  rect(15, -10, label.length * 7.4, 15);
  fill(0, 0, 100, 1);
  text(label, 15, 0);
  pop();
};

const drawCrosshair = () => {
  strokeWeight(2);
  // stroke(0, 0, 100, 0.9);
  line(-15, 0, 15, 0);
  line(0, -15, 0, 15);
  for (let theta = 0; theta < TAU; theta += TAU / 4) {
    push();
    rotate(theta);
    translate(15, 0);
    line(0, 0, -5, 5);
    line(0, 0, -5, -5);
    pop();
  }
};

const oscTypes = {
  circle: {
    color: COLORS.CIRCLE,
    waveType: "sine",
    renderShape: (size, useCentroid, rotation) => {
      push();
      if (rotation) {
        rotate(rotation);
      }
      const r = Math.sqrt(size / PI);
      ellipse(0, 0, r * 2, r * 2);
      line(0, 0, 0, -r);
      // strokeWeight(r / 5);
      // ellipse(0, -r * 0.7, 1, 1);
      pop();
    },
  },
  square: {
    color: COLORS.SQUARE,
    waveType: "square",
    renderShape: (size, useCentroid, rotation) => {
      push();
      const sideL = sqrt(size);
      rectMode(CENTER);
      if (rotation) {
        rotate(rotation);
      }
      rect(0, 0, sideL);
      pop();
    },
  },
  triangle: {
    color: COLORS.TRIANGLE,
    waveType: "triangle",
    renderShape: (size, useCentroid = true, rotation) => {
      // equilateral triangle
      push();
      const sideL = Math.sqrt((size * 4) / Math.sqrt(3));
      const h = (-sideL * Math.sqrt(3)) / 2;

      if (rotation) {
        rotate(rotation);
      }
      // ellipse(0, 0, 5, 5);
      if (useCentroid) {
        const a = sideL / 2;
        const offset = a * tan(radians(30));
        translate(0, offset);
      } else {
        translate(0, -h / 2);
      }
      beginShape();
      vertex(0, h);
      vertex(sideL / 2, 0);
      vertex(-sideL / 2, 0);
      endShape(CLOSE);
      pop();
    },
  },
  sawtooth: {
    color: COLORS.SAWTOOTH,
    waveType: "sawtooth",
    renderShape: (size, useCentroid = true, rotation) => {
      push();
      const baseL = Math.sqrt(size * (2 * (4 / 3)));
      const h = baseL * 0.75;

      if (rotation) {
        rotate(rotation);
      }
      if (useCentroid) {
        translate(-baseL / 3, h / 3);
      } else {
        translate(-baseL / 2, h / 2);
      }
      beginShape();
      vertex(0, 0);
      vertex(0, -h);
      vertex(baseL, 0);
      endShape(CLOSE);
      pop();
    },
  },
};

/* 
 ================================================
 ================================================
 ================================================
*/
function OscillatorShape({
  harmonicIndex,
  xPos,
  initialSize,
  type,
  initialDepth = 0,
  initialRate = 0,
  initialRotation = 0,
}) {
  const { renderShape, color, waveType } = oscTypes[type];
  const yPos = sectionHeight * harmonicIndex + H_OFFSET;
  const pos = createVector(xPos, yPos);
  const startMillis = millis();

  this.harmonicIndex = harmonicIndex;
  this.note = musicScale.get(activeNoteIndex);

  let count = 0;
  let size = initialSize;
  let isHovered = false;
  let xAmplitude = initialDepth < 5 ? 0 : initialDepth;
  let dragStartPos = pos;

  const oscs = [
    new Tone.Oscillator({
      type: waveType,
      volume: -Infinity,
    }),
  ];

  const vibrato = new Tone.Vibrato({
    frequency: initialRate,
    depth: 0,
    wet: 1,
  });

  vibrato.depth.value = constrain(map(xAmplitude, 0, width / 2, 0, 1), 0, 1);

  this.setNote = (note) => {
    this.note = note;
    const fq = this.note.fq();
    oscs.forEach((osc) =>
      osc.set({ frequency: fq * (NUM_HARMONICS - this.harmonicIndex + 1) })
    );
  };

  this.setNote(this.note);

  const filter = new Tone.Filter({ type: "lowpass", frequency: 15000 });
  const autoPan = new Tone.AutoPanner({
    frequency: initialRotation < 0.5 ? 0 : initialRotation,
    wet: 1,
    depth: 0.8,
  }).start();

  const getVolume = () => map(size, MIN_SHAPE_SIZE, MAX_SHAPE_SIZE, -30, 0);

  const setXPos = (x) => {
    pos.x = x;
    filter.frequency.rampTo(pow(2, map(pos.x, 0, width, 6, 12)), 0.1);
  };

  const setHarmonic = (harmonicIndex) => {
    this.harmonicIndex = harmonicIndex;
    pos.y = sectionHeight * harmonicIndex + H_OFFSET;
    this.setNote(this.note);
  };

  // let rotationAmount = 0;
  oscs.forEach((osc) => osc.chain(vibrato, filter, autoPan, OUTPUT_NODE));
  oscs.forEach((osc) => osc.start());
  oscs.forEach((osc) => osc.volume.rampTo(getVolume(), 0.3));
  setXPos(xPos);

  this.destroy = () => {
    oscs.forEach((osc) => osc.volume.rampTo(-Infinity, 0.5));
    setTimeout(() => {
      oscs.forEach((osc) => osc.stop());
      oscs.forEach((osc) => osc.disconnect());
      vibrato.dispose();
      autoPan.dispose();
      filter.dispose();
      oscs.forEach((osc) => osc.dispose());
    }, 500);
  };

  this.getIsHovered = () => {
    let hoverRadius = Math.sqrt(size / Math.PI) * 1.5;
    hoverRadius = max(10, hoverRadius);
    const mousePos = getMousePos();
    return dist(mousePos.x, mousePos.y, pos.x, pos.y) < hoverRadius;
  };

  this.handleMouseIn = () => {
    isHovered = true;
  };

  this.handleMouseOut = () => {
    isHovered = false;
  };

  this.handleDragStart = (position) => {
    dragStartPos = position;
    dragStartSize = size;
    dragStartXAmplitude = xAmplitude;
    dragStartVibratoFreq = vibrato.frequency.value;
    dragStartRotation = map(autoPan.frequency.value, 0, 2, -PI, PI);
  };

  this.handleDrag = () => {
    const mousePos = getMousePos();
    const deltaX = mousePos.x - dragStartPos.x;
    const deltaY = dragStartPos.y - mousePos.y;
    if (keyIsDown(SHIFT)) {
      size = dragStartSize + deltaY * 100;
      size = constrain(size, MIN_SHAPE_SIZE, MAX_SHAPE_SIZE);
      oscs.forEach((osc) => osc.volume.rampTo(getVolume(), 0.1));
      let rotationAmount = dragStartRotation + deltaX / 100;

      rotationAmount = constrain(rotationAmount, -PI, PI);

      if (PI + rotationAmount < 0.4) {
        rotationAmount = -PI;
      }

      autoPan.frequency.value = map(rotationAmount, -PI, PI, 0, 2);
    } else if (keyIsDown(ALT)) {
      xAmplitude = dragStartXAmplitude + deltaX;
      xAmplitude = constrain(xAmplitude, 0, width / 2);
      const newFreq = dragStartVibratoFreq + deltaY / 15;
      vibrato.frequency.value = constrain(newFreq, 0.5, 10);
      vibrato.depth.value = map(xAmplitude, 0, width / 2, 0, 1);
    } else {
      setXPos(mousePos.x);
      if (hoveredHarmonic > -1) {
        setHarmonic(hoveredHarmonic);
      }
    }
  };

  this.show = () => {
    const [h, s, l] = color;

    let light = isHovered ? l * 1.3 : l;
    if (isHovered && !keyIsDown(ALT) && !keyIsDown(SHIFT)) {
      light = light * map(sin(count / 5), -1, 1, 1, 1.4);
    }
    light = map(pos.x, 0, width, light - 30, light + 15);

    const sat = isHovered ? s * 1.2 : s;

    strokeWeight(2);

    // ghost dot
    push();

    translate(pos.x, pos.y);
    if (!(isHovered && keyIsDown(SHIFT))) {
      canv.drawingContext.setLineDash([5, 4]);
      stroke(h, sat, light * 1.2, 0.6);
    } else {
      stroke(h, sat, light * 1.2, 0.8);
      strokeWeight(map(sin(count / 5), -1, 1, 3, 8));
    }
    fill(h, sat, light, 0);
    const staticRotation = map(autoPan.frequency.value, 0, 2, 0, PI);
    renderShape(size, true, staticRotation);
    const r = Math.sqrt(size / PI);
    line(0, 0, 0, -r);
    push();
    rotate(staticRotation);
    line(0, 0, 0, -r);
    pop();
    fill(h, sat, light, 0.5);

    arc(0, 0, r, r, -PI / 2, -PI / 2 + staticRotation);
    // renderShape(size / rotationAmount + 1);
    canv.drawingContext.setLineDash([]);
    pop();

    const fq = vibrato.frequency.value;
    const p = fq;

    // moving shape
    const currX =
      pos.x + sin(((millis() - startMillis) / 1000) * p) * xAmplitude;
    push();

    translate(currX, pos.y);
    stroke(h, sat, light * 1.2);
    fill(h, sat, light, isHovered ? 0.5 : 0.9);
    const rotation =
      (autoPan.frequency.value * ((millis() - startMillis) * TAU)) / 1000;
    // const rotation = count * autoPan.frequency.value;
    renderShape(size, true, rotation);
    pop();

    // colored bar
    push();

    fill(h, sat, light);
    noStroke();
    rectMode(CENTER);
    translate(pos.x, pos.y);
    if (isHovered && keyIsDown(ALT)) {
      scale(1, map(sin(count / 5), -1, 1, 1.1, 2));
    }
    rect(0, 0, xAmplitude * 2, this.harmonicIndex);
    rect(xAmplitude, 0, 4, this.harmonicIndex + 10);
    rect(-xAmplitude, 0, 4, this.harmonicIndex + 10);
    for (let i = 0; i < xAmplitude; i += xAmplitude / (fq / 2)) {
      fill(h, sat, light);
      noStroke();
      rectMode(CENTER);
      rect(i, 0, 2, this.harmonicIndex + 6);
      rect(-i, 0, 2, this.harmonicIndex + 6);
    }
    pop();

    push();
    translate(currX, pos.y);
    stroke(h, sat, light * 1.2);

    strokeWeight(8);
    ellipse(0, 0, 1);
    pop();

    count++;
  };
}

/* 
 ================================================
 ================================================
 ================================================
*/

const drawBackground = (ctx) => {
  ctx.colorMode(HSL);

  // bottom panel
  ctx.fill(0, 0, 16, 1);
  ctx.noStroke();
  ctx.rectMode(CORNER);
  ctx.rect(0, inputHeight, width, height);

  // ctx.push();
  // ctx.stroke(0, 0, 14, 1);
  // ctx.fill(0, 0, 14, 1);
  // ctx.strokeWeight(20);
  // ctx.rectMode(CORNERS);
  // ctx.rect(
  //   buttonPanelPos.x,
  //   buttonPanelPos.y,
  //   buttonPanelPos.x + buttonPanelWidth,
  //   height - X_PAD / 2 - 20
  // );
  // ctx.rect(
  //   X_PAD / 2,
  //   buttonPanelPos.y,
  //   X_PAD / 2 + buttonPanelPos.x - 45,
  //   height - X_PAD / 2 - 20
  // );
  // ctx.pop();

  // visualizer background
  ctx.push();
  ctx.translate(width * 0.22, inputHeight + (height - inputHeight) / 2 + 10);
  ctx.fill(0, 0, 0, 0.2);
  ctx.noStroke();
  ctx.ellipse(0, 0, 240);
  ctx.ellipse(0, -0, 220);
  ctx.pop();

  // input area
  ctx.fill(0, 0, 10, 1);
  ctx.noStroke();
  ctx.rectMode(CORNER);
  ctx.rect(0, 0, width, inputHeight);

  const borderWidth = 12;
  const depth = 40;
  const outer = [
    [borderWidth, borderWidth],
    [width - borderWidth, borderWidth],
    [width - borderWidth, inputHeight],
    [borderWidth, inputHeight],
  ];
  const inner = [
    [outer[0][0] + depth, outer[0][1] + depth / 1.3],
    [outer[1][0] - depth, outer[1][1] + depth / 1.3],
    [outer[2][0] - depth, outer[2][1] - depth / 2],
    [outer[3][0] + depth, outer[3][1] - depth / 2],
  ];

  // top
  ctx.fill(0, 0, 3, 1);
  ctx.quad(...outer[0], ...inner[0], ...inner[1], ...outer[1]);

  // sides
  ctx.fill(0, 0, 8, 1);
  ctx.quad(...outer[0], ...inner[0], ...inner[3], ...outer[3]);
  ctx.quad(...outer[1], ...inner[1], ...inner[2], ...outer[2]);

  // bottom
  ctx.fill(0, 0, 19, 1);
  ctx.quad(...outer[3], ...inner[3], ...inner[2], ...outer[2]);

  for (let i = NUM_HARMONICS; i > 0; i--) {
    const y = sectionHeight * i + H_OFFSET;
    for (let j = 0; j < width - 2 * X_PAD; j++) {
      ctx.fill(0, 0, map(j, 0, width, 10, 50), 0.2);
      ctx.noStroke();
      ctx.ellipse(j + X_PAD, y, i);
    }
    for (let j = 0; j < width - 2 * X_PAD; j++) {
      ctx.stroke(0, 0, map(j, 0, width, 20, 100), 1);
      ctx.strokeWeight(i / 2);
      ctx.point(j + X_PAD, y);
    }
  }
};

function setup() {
  canv = createCanvas(800, 1000);
  canv.parent("sketch");
  inputHeight = height * (2 / 3);
  sectionHeight = (inputHeight * 0.85) / NUM_HARMONICS;
  buttonPanelPos = createVector(width * 0.45, inputHeight + 20);
  buttonPanelWidth = width - buttonPanelPos.x - X_PAD / 2;
  colorMode(HSL);
  textFont("Roboto Mono");

  backgroundGraphics = createGraphics(width, height);
  drawBackground(backgroundGraphics);
  const resetButton = createButton("Reset");
  const clearAllShapes = () => {
    oscillatorShapes.forEach((shape) => {
      shape.destroy();
    });
    buttonClick.playbackRate = 0.3;

    buttonClick.start();
    oscillatorShapes.length = 0;
  };
  resetButton.position(X_PAD / 2, inputHeight + 16);
  resetButton.parent("#sketch");
  resetButton.mouseClicked(clearAllShapes);

  const randomizeButton = createButton("Randomize");
  randomizeButton.position(X_PAD / 2 + 55, inputHeight + 16);
  randomizeButton.parent("#sketch");
  randomizeButton.mouseClicked(() => {
    clearAllShapes();
    oscTypes.circle.color = [random(0, 360), random(40, 55), 50];
    oscTypes.square.color = [random(0, 360), random(40, 55), 50];
    oscTypes.triangle.color = [random(0, 360), random(40, 55), 50];
    oscTypes.sawtooth.color = [random(0, 360), random(40, 55), 50];
    const n = floor(random(2, 15));
    for (let i = 0; i < n; i++) {
      const delay = random(0, i * 50);

      setTimeout(() => {
        uiBlip.playbackRate = map(i, 0, n, 0.5, 2);
        uiBlip.start();
        oscillatorShapes.push(
          new OscillatorShape({
            harmonicIndex: ceil(random(NUM_HARMONICS)),
            xPos: random(X_PAD, width - X_PAD),
            initialSize: random(MIN_SHAPE_SIZE, MAX_SHAPE_SIZE),
            type: Object.keys(oscTypes)[
              floor(random(Object.keys(oscTypes).length))
            ],
            initialRotation: random(0, 1),
            initialRate: random(0, 4),
            initialDepth: random(0, 100),
          })
        );
      }, delay);
    }
  });

  // wait for mouse movements to start loop
  // noLoop();
}

function draw() {
  background(0, 0, 14, 1);
  image(backgroundGraphics, 0, 0);
  rectMode(CENTER);

  let isAnyHovered = false;

  // harmonic lines
  for (let i = NUM_HARMONICS; i > 0; i--) {
    const y = sectionHeight * i + H_OFFSET;
    if (!someShapeIsHovered && abs(y - mouseY) < sectionHeight / 2) {
      hoveredHarmonic = i;
      isAnyHovered = true;
    }
  }

  // existing shapes
  oscillatorShapes.forEach((shape) => {
    shape.show();
  });

  if (!isAnyHovered) {
    hoveredHarmonic = -1;
  }

  // shape at mouse
  if (hoveredShapeIndex === -1 && hoveredHarmonic > -1) {
    const { renderShape, color } = oscTypes[activeShape];
    push();
    strokeWeight(2);
    const mousePos = getMousePos();
    translate(mousePos.x, sectionHeight * hoveredHarmonic + H_OFFSET);
    const [h, s, l] = color;
    const light = map(mousePos.x, 0, width, l - 30, l + 15);
    stroke(h, s, light * 1.2);
    fill(h, s, light, 0.9);
    renderShape(activeSize);
    strokeWeight(8);
    ellipse(0, 0, 1, 1);
    pop();
  }

  // border
  strokeWeight(X_PAD);
  stroke(0, 0, 16, 1);
  noFill();
  rect(width / 2, height / 2, width, height);
  fill(0, 0, 16, 1);
  push();
  rectMode(CORNER);
  noStroke();
  rect(0, inputHeight, width, 55);
  pop();

  // strokeWeight(2);
  // stroke(0, 0, 10, 1);
  // rect(width / 2, height / 2, width, height);
  // rectMode(CORNER);
  // rect(18, 18, width - 2 * 18, inputHeight - 18);
  // rectMode(CENTER);

  // visualizer
  push();
  translate(width * 0.22, inputHeight + (height - inputHeight) / 2 + 10);
  strokeWeight(1);

  stroke(0, 0, 100, 0.2);
  // stroke(...oscTypes[activeShape].color, 0.2);
  noFill();
  beginShape();

  let waveform = analyzer.getValue();
  // console.log()
  let theta = 0;

  for (let i = 0; i < SAMPLE_RATE; i++) {
    let val = map(waveform[i], -1, 1, -150, 150);
    vertex(cos(theta) * val, sin(theta) * val);
    theta += 360 / SAMPLE_RATE;
  }

  endShape();
  pop();

  // UI controls

  // Shape buttons
  let someButtonIsHovered = false;

  push();

  Object.keys(oscTypes).forEach((key, i, keys) => {
    const { renderShape, color } = oscTypes[key];
    const w = (buttonPanelWidth / keys.length) * 0.93;
    const padding = w * 0.1;
    const x = i * (w + padding);
    const absX = x + buttonPanelPos.x;

    const cx = absX + w / 2;
    const cy = buttonPanelPos.y + w / 2;
    const isHovering = abs(mouseX - cx) < w / 2 && abs(mouseY - cy) < w / 2;

    const isActive = isHovering || activeShape === key;

    if (isHovering) {
      someButtonIsHovered = true;
      hoveredShapeButton = key;
      cursor("pointer");
    }

    push();
    translate(buttonPanelPos.x + x, buttonPanelPos.y);
    rectMode(CORNER);
    const [h, s, l] = color;
    const borderL = isActive
      ? map(sin(frameCount / 10), -1, 1, l * 1, l * 1.3)
      : l;
    fill(...color, isActive ? 0.4 : 0.1);
    stroke(h, s, borderL, isActive ? 0.9 : 0.1);
    strokeWeight(isActive ? map(sin(frameCount / 6), -1, 1, 3, 5) : 2);
    rect(0, 0, w, w);
    fill(...color, isActive ? 1 : 0.5);
    stroke(...color, isActive ? 1 : 0.5);
    strokeWeight(2);
    push();
    translate(w / 2, w / 2);
    renderShape(700, false);
    pop();
    strokeWeight(0);
    text(i + 1, 15, 18);
    pop();
  });
  pop();

  if (!someButtonIsHovered) {
    hoveredShapeButton = null;
  }

  // mouse drag behavior visual feedback
  push();
  translate(buttonPanelPos.x, buttonPanelPos.y + 140);
  fill(0, 0, 100, 0.9);
  noStroke();

  dragBehaviorControls.forEach(({ renderLogo, getIsSelected, label }, i) => {
    const isSelected = getIsSelected();
    const w = (buttonPanelWidth / 3) * 0.938;
    const padding = w * 0.05;
    push();
    translate(i * (w + padding) + i * padding, 0);
    fill(0, 0, 10, isSelected ? 0.5 : 0.2);
    strokeWeight(1);
    stroke(0, 0, 80, isSelected ? 0.9 : 0.1);
    rectMode(CORNER);
    rect(0, 0, w);
    push();
    fill(0, 0, isSelected ? 100 : 40, 1);
    stroke(0, 0, isSelected ? 100 : 40, 1);
    translate(w / 2, w / 2);
    renderLogo();
    pop();
    if (label) {
      fill(0, 0, 100, isSelected ? 1 : 0.5);
      // stroke(0, 0, 100, isSelected ? 1 : 0.5);
      strokeWeight(1);

      rectMode(CORNER);
      rect(0, 0, 50, -20);
      fill(0, 0, 10, 1);
      noStroke();
      text(label, 5, -6);
    }
    pop();
  });

  pop();

  push();
  // translate(0, 0);
  PLAYABLE_NOTES.split("").forEach((l, i) => {
    const isActive = i + 1 === activeNoteIndex;
    const x = map(i, 0, PLAYABLE_NOTES.length, 0, width);
    const y = height - 20;
    const w = width / PLAYABLE_NOTES.length;
    fill(0, 0, isActive ? 80 : 12, 1);
    noStroke();
    rectMode(CORNER);
    rect(x, y, w, y + 20);
    fill(0, 0, isActive ? 10 : 40, 1);
    text(l, x + 10, y + 14);
  });
  pop();

  if (hoveredShapeIndex > -1) {
    if (keyIsDown(ALT)) {
      showToolTip("Drag to change movement speed and length");
    } else if (keyIsDown(SHIFT)) {
      showToolTip("Drag to change size and rotation");
    }
  }
}

function mouseMoved() {
  // loop();
  hoveredShapeIndex = -1;
  oscillatorShapes.forEach((shape, i) => {
    if (shape.getIsHovered()) {
      hoveredShapeIndex = i;
    }
  });
  oscillatorShapes.forEach((shape, i) => {
    if (i === hoveredShapeIndex) {
      shape.handleMouseIn();
    } else {
      shape.handleMouseOut();
    }
  });
  if (hoveredShapeIndex > -1) {
    if (keyIsDown(ALT) || keyIsDown(SHIFT)) {
      cursor("move");
    } else {
      cursor("grab");
    }
  } else {
    cursor("initial");
  }
}

function mouseDragged() {
  if (hoveredShapeIndex > -1) {
    oscillatorShapes[hoveredShapeIndex].handleDrag();
  }
}

function mousePressed() {
  if (hoveredShapeIndex > -1) {
    oscillatorShapes[hoveredShapeIndex].handleDragStart(getMousePos());
    return;
  }

  if (hoveredHarmonic > -1) {
    uiBlip.playbackRate = map(hoveredHarmonic, 0, NUM_HARMONICS, 2, 0.5);
    uiBlip.start();
    oscillatorShapes.push(
      new OscillatorShape({
        harmonicIndex: hoveredHarmonic,
        xPos: getMousePos().x,
        initialSize: activeSize,
        type: activeShape,
      })
    );
  }

  if (hoveredShapeButton) {
    setActiveShape(hoveredShapeButton);
  }
}

function keyPressed() {
  if (key === "1") {
    setActiveShape("circle");
  }
  if (key === "2") {
    setActiveShape("square");
  }
  if (key === "3") {
    setActiveShape("triangle");
  }
  if (key === "4") {
    setActiveShape("sawtooth");
  }

  PLAYABLE_NOTES.split("").forEach((l, i) => {
    if (key.toLowerCase() === l.toLowerCase()) {
      activeNoteIndex = i + 1;
      oscillatorShapes.forEach(({ setNote }) => {
        setNote(musicScale.get(activeNoteIndex));
      });
    }
  });
}
