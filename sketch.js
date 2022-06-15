const MAX_SHAPE_AREA = 15000;
const MIN_SHAPE_AREA = 100;
const NUM_HARMONICS = 8;
const X_PAD = 36;
const SAMPLE_RATE = Math.pow(2, 12);
const H_OFFSET = 10;
const PLAYABLE_KEYS = "ASDFGHJK";
const DEFAULT_COLORS = {
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
let activeSize = 0.4;
let backgroundGraphics;
let someShapeIsHovered = false;
let activeChordRoot = 1;
let hoveredShapeIndex = -1;
let hoveredShapeButton = null;
let activeNoteIndex = 1;

let tooltipText = "";
let tooltipDiv;

let buttonPanelPos;
let buttonPanelWidth;

const oscillatorShapes = [];

const musicScale = new teoria.note("A1").scale("major");

// Button sound
const buttonClick = new Tone.Player("./fx_click.wav").toDestination();
buttonClick.playbackRate = 0.4;
buttonClick.volume.value = -10;

// Sound when placing a shape
const uiBlip = new Tone.Player("./blip_hi.wav");
uiBlip.connect(new Tone.Filter({ type: "lowpass", frequency: 1000 }));
uiBlip.connect(Tone.Destination);
uiBlip.volume.value = -20;

// Output envelope
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

const isCmdPressed = () => keyIsDown(224);

const dragBehaviorControls = [
  {
    getIsSelected: () => !keyIsDown(SHIFT) && !isCmdPressed(),
    renderLogo: () => {
      scale(1.4);
      drawCrosshair();
    },
  },
  {
    getIsSelected: isCmdPressed,
    label: "CMD",
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
  if (!tooltipDiv.class().includes("is-visible")) {
    tooltipDiv.addClass("is-visible");
  }
  tooltipDiv.html(label);
  tooltipDiv.position(mouseX + 15, mouseY - 12);
};

hideToolTip = () => {
  tooltipDiv.removeClass("is-visible");
};

const drawCrosshair = () => {
  strokeWeight(2);
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
    color: DEFAULT_COLORS.CIRCLE,
    waveType: "sine",
    renderShape: (size, useCentroid, rotation) => {
      push();
      if (rotation) {
        rotate(rotation);
      }
      const r = Math.sqrt(size / PI);
      ellipse(0, 0, r * 2, r * 2);
      line(0, 0, 0, -r);
      pop();
    },
  },
  square: {
    color: DEFAULT_COLORS.SQUARE,
    waveType: "square",
    renderShape: (area, useCentroid, rotation) => {
      push();
      const sideL = sqrt(area);
      rectMode(CENTER);
      if (rotation) {
        rotate(rotation);
      }
      rect(0, 0, sideL);
      pop();
    },
  },
  triangle: {
    color: DEFAULT_COLORS.TRIANGLE,
    waveType: "triangle",
    renderShape: (area, useCentroid = true, rotation) => {
      // equilateral triangle
      push();
      const sideL = Math.sqrt((area * 4) / Math.sqrt(3));
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
    color: DEFAULT_COLORS.SAWTOOTH,
    waveType: "sawtooth",
    renderShape: (area, useCentroid = true, rotation) => {
      push();
      const baseL = Math.sqrt(area * (2 * (4 / 3)));
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
  initialHarmonicIndex, // [0,NUM_HARMONICS]
  xPos, // [0,1]
  type, // ['sine', 'square', 'triangle', 'sawtooth']
  initialSize, // [0,1]
  initialMovementDepth = 0, // [0,1]
  initialMovementRate = 0, // [0,1]
  initialRotation = 0, // [0,1]
}) {
  const startMillis = millis();
  const { renderShape, color, waveType } = oscTypes[type];

  // Converters between normal ranges and actual values
  const sizeToVolume = () => map(size, 0, 1, -30, 0);
  const sizeToSurfaceArea = (size) =>
    map(size, 0, 1, MIN_SHAPE_AREA, MAX_SHAPE_AREA);

  const harmonicIndexToYPos = (idx) => sectionHeight * idx + H_OFFSET;

  const movementDepthToXAmplitude = (depth) =>
    map(depth, 0, 1, 0, width / 2 - X_PAD);
  const movementRateToFrequency = (rate) => map(rate, 0, 1, 0.5, 10);
  const rotationAmountToFrequency = (rotation) => map(rotation, 0, 1, 0, 10);
  const rotationAmountToTheta = (rotation) => map(rotation, 0, 1, 0, PI);

  let harmonicIndex = initialHarmonicIndex;

  const pos = createVector(xPos, harmonicIndexToYPos(harmonicIndex));

  this.note = musicScale.get(activeNoteIndex);

  let count = 0;
  let size = initialSize;
  let isHovered = false;
  let movementDepth = initialMovementDepth < 0.2 ? 0 : initialMovementDepth;
  let movementRate = initialMovementRate;
  let rotationAmount = initialRotation < 0.2 ? 0 : initialRotation;
  let dragStartPos = pos;

  // this.getState = () => ({
  //   pos: { x: pos.x, y: pos.y },
  //   size,
  //   isHovered,
  // });

  const oscs = [
    new Tone.Oscillator({
      type: waveType,
      volume: -Infinity,
    }),
    new Tone.Oscillator({
      type: waveType,
      volume: -Infinity,
    }),
  ];

  const vibrato = new Tone.Vibrato({
    frequency: movementRateToFrequency(movementRate),
    depth: movementDepth,
    wet: 1,
  });

  this.setNote = (note) => {
    this.note = note;
    const fq = this.note.fq();
    oscs.forEach((osc) =>
      osc.set({ frequency: fq * (NUM_HARMONICS - harmonicIndex + 1) })
    );
    // oscs[0].set({ frequency: fq * (NUM_HARMONICS - harmonicIndex + 1) });
    // oscs[1].set({
    //   frequency: musicScale.get(1).fq() * (NUM_HARMONICS - harmonicIndex + 1),
    // });
  };

  this.setNote(this.note);

  const filter = new Tone.Filter({ type: "lowpass", frequency: 15000 });
  const autoPan = new Tone.AutoPanner({
    frequency: rotationAmountToFrequency(rotationAmount),
    wet: 1,
    depth: 0.8,
  }).start();

  const setXPos = (x) => {
    pos.x = x;
    filter.frequency.rampTo(pow(2, map(pos.x, 0, width, 6, 12)), 0.1);
  };

  const setHarmonic = (newIndex) => {
    harmonicIndex = newIndex;
    pos.y = harmonicIndexToYPos(harmonicIndex);
    this.setNote(this.note);
  };

  // let rotationAmount = 0;
  oscs.forEach((osc) => osc.chain(vibrato, filter, autoPan, OUTPUT_NODE));
  oscs.forEach((osc) => osc.start());
  oscs.forEach((osc) => osc.volume.rampTo(sizeToVolume(), 0.3));
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
    const sa = sizeToSurfaceArea(size);
    let hoverRadius = Math.sqrt(sa / Math.PI) * 1.5;
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
    dragStartMovementDepth = movementDepth;
    dragStartMovementRate = movementRate;
    dragStartRotation = rotationAmount;
  };

  this.handleDrag = () => {
    const mousePos = getMousePos();
    const deltaX = mousePos.x - dragStartPos.x;
    const deltaY = dragStartPos.y - mousePos.y;

    if (keyIsDown(SHIFT)) {
      size = dragStartSize + deltaY / 100;
      size = constrain(size, 0, 1);
      oscs.forEach((osc) => osc.volume.rampTo(sizeToVolume(), 0.1));
      rotationAmount = dragStartRotation + deltaX / 400;
      rotationAmount = constrain(rotationAmount, 0, 1);
      if (rotationAmount < 0.02) {
        rotationAmount = 0;
      }
      autoPan.frequency.value = rotationAmountToFrequency(rotationAmount);
    } else if (isCmdPressed()) {
      movementDepth = dragStartMovementDepth + deltaX / (width / 2);
      movementRate = dragStartMovementRate + deltaY / 100;
      movementDepth = constrain(movementDepth, 0, 1);
      movementRate = constrain(movementRate, 0, 1);
      vibrato.frequency.value = movementRateToFrequency(movementRate);
      vibrato.depth.value = movementDepth;
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
    if (isHovered && !isCmdPressed() && !keyIsDown(SHIFT)) {
      light = light * map(sin(count / 5), -1, 1, 1, 1.4);
    }
    light = map(pos.x, 0, width, light - 30, light + 15);

    const sat = isHovered ? s * 1.2 : s;

    strokeWeight(2);

    // dotted outline dot
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

    rotationTheta = rotationAmountToTheta(rotationAmount);

    const sa = sizeToSurfaceArea(size);
    const r = Math.sqrt(sa / PI);

    renderShape(sa, true, rotationTheta);
    line(0, 0, 0, -r);
    push();
    rotate(rotationTheta);
    line(0, 0, 0, -r);
    pop();
    fill(h, sat, light, 0.5);

    arc(0, 0, r, r, -PI / 2, -PI / 2 + rotationTheta);
    canv.drawingContext.setLineDash([]);
    pop();

    // moving shape
    const fq = vibrato.frequency.value;
    const xAmplitude = movementDepthToXAmplitude(vibrato.depth.value);
    const currX =
      pos.x + sin(((millis() - startMillis) / 1000) * fq) * xAmplitude;
    push();

    translate(currX, pos.y);
    stroke(h, sat, light * 1.2);
    fill(h, sat, light, isHovered ? 0.5 : 0.9);

    const rotation = (rotationTheta * ((millis() - startMillis) * TAU)) / 1000;

    renderShape(sa, true, rotation / 2);
    pop();

    // colored bar
    push();

    fill(h, sat, light);
    noStroke();
    rectMode(CENTER);
    translate(pos.x, pos.y);
    if (isHovered && isCmdPressed()) {
      scale(1, map(sin(count / 5), -1, 1, 1.1, 2));
    }
    rect(0, 0, xAmplitude * 2, harmonicIndex);
    rect(xAmplitude, 0, 4, harmonicIndex + 10);
    rect(-xAmplitude, 0, 4, harmonicIndex + 10);
    for (let i = 0; i < xAmplitude; i += xAmplitude / (fq / 2)) {
      fill(h, sat, light);
      noStroke();
      rectMode(CENTER);
      rect(i, 0, 2, harmonicIndex + 6);
      rect(-i, 0, 2, harmonicIndex + 6);
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
  canv = createCanvas(720, 900);
  canv.parent("sketch");
  inputHeight = height * (2 / 3);
  sectionHeight = (inputHeight * 0.85) / NUM_HARMONICS;
  buttonPanelPos = createVector(width * 0.45, inputHeight + 20);
  buttonPanelWidth = width - buttonPanelPos.x - X_PAD / 2;
  colorMode(HSL);
  textFont("Roboto Mono");

  tooltipDiv = createDiv();
  tooltipDiv.addClass("tooltip");
  tooltipDiv.parent("#sketch");

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
            initialHarmonicIndex: ceil(random(NUM_HARMONICS)),
            xPos: random(X_PAD, width - X_PAD),
            initialSize: random(0, 1),
            type: Object.keys(oscTypes)[
              floor(random(Object.keys(oscTypes).length))
            ],
            initialRotation: random(0, 0.5),
            initialMovementRate: random(0, 0.5),
            initialMovementDepth: random(0, 0.5),
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
    renderShape(map(activeSize, 0, 1, MIN_SHAPE_AREA, MAX_SHAPE_AREA));
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

  const visCx = width * 0.22;
  const visCy = inputHeight + (height - inputHeight) / 2 + 10;

  push();

  translate(visCx, visCy);
  strokeWeight(1);

  stroke(0, 0, 100, 0.2);
  // stroke(...oscTypes[activeShape].color, 0.2);
  noFill();
  beginShape();

  let waveform = analyzer.getValue();
  let theta = 0;

  for (let i = 0; i < SAMPLE_RATE; i++) {
    let val = map(waveform[i], -1, 1, -130, 130);
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

  if (hoveredShapeIndex > -1) {
    if (isCmdPressed()) {
      tooltipText = "Drag to change movement speed and length";
    } else if (keyIsDown(SHIFT)) {
      tooltipText = "Drag to change size and rotation";
    } else {
      tooltipText = "";
    }
  } else if (dist(mouseX, mouseY, visCx, visCy) < 100) {
    tooltipText = "Output";
  } else {
    tooltipText = "";
  }

  // mouse drag behavior visual feedback
  push();
  translate(buttonPanelPos.x, buttonPanelPos.y + 140);
  fill(0, 0, 100, 0.9);
  noStroke();

  dragBehaviorControls.forEach(({ renderLogo, getIsSelected, label }, i) => {
    const isSelected = getIsSelected();
    const y = buttonPanelPos.y + 140;
    const w = (buttonPanelWidth / 3) * 0.938;
    const padding = w * 0.05;
    const x = i * (w + padding) + i * padding;
    const isHovering =
      mouseX > buttonPanelPos.x &&
      mouseX - (buttonPanelPos.x + x) < w - padding &&
      mouseY - y < w - padding &&
      mouseY > buttonPanelPos.y + 140;

    if (isHovering) {
      tooltipText =
        "Hold CMD or SHIFT on your keyboard to change what happens when you drag a shape";
    }

    push();
    translate(x, 0);
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
      rect(0, 0, label.length * 10, -20);
      fill(0, 0, 10, 1);
      noStroke();
      text(label, 5, -6);
    }
    pop();
  });

  pop();

  push();
  // translate(0, 0);
  PLAYABLE_KEYS.split("").forEach((l, i) => {
    const isActive = i + 1 === activeNoteIndex;
    const x = map(i, 0, PLAYABLE_KEYS.length, 0, width);
    const y = height - 20;
    const w = width / PLAYABLE_KEYS.length;
    fill(0, 0, isActive ? 80 : 12, 1);
    noStroke();
    rectMode(CORNER);
    rect(x, y, w, y + 20);
    fill(0, 0, isActive ? 10 : 40, 1);
    text(l, x + 10, y + 14);
  });
  pop();

  if (tooltipText) {
    showToolTip(tooltipText);
  } else {
    hideToolTip();
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
    if (isCmdPressed() || keyIsDown(SHIFT)) {
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
  const mousePos = getMousePos();
  if (hoveredShapeIndex > -1) {
    oscillatorShapes[hoveredShapeIndex].handleDragStart(mousePos);
    return;
  }

  if (hoveredHarmonic > -1) {
    uiBlip.playbackRate = map(hoveredHarmonic, 0, NUM_HARMONICS, 2, 0.5);
    uiBlip.start();
    oscillatorShapes.push(
      new OscillatorShape({
        initialHarmonicIndex: hoveredHarmonic,
        xPos: mousePos.x,
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

  PLAYABLE_KEYS.split("").forEach((l, i) => {
    if (key.toLowerCase() === l.toLowerCase()) {
      activeNoteIndex = i + 1;
      oscillatorShapes.forEach(({ setNote }) => {
        setNote(musicScale.get(activeNoteIndex));
      });
    }
  });
}
