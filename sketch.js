const musicScale = new teoria.note("A3").scale("major");
let activeShape = "circle";
let activeSize = 5000;
const MAX_SIZE = 15000;
const MIN_SIZE = 100;
const SAMPLE_RATE = Math.pow(2, 12);
const OUTPUT_NODE = new Tone.Gain(0.3);
const analyzer = new Tone.Waveform(SAMPLE_RATE);
OUTPUT_NODE.fan(analyzer, Tone.Destination);
let someShapeIsHovered = false;
let activeChordRoot = 1;
let hoveredShapeIndex = -1;

const numHarmonics = 6;
let inputHeight;
let sectionHeight;
let hoveredHarmonic = -1;
const hOffset = 0;
const oscillatorShapes = [];
let canv;

const COLORS = {
  CIRCLE: [80, 50, 50],
  SQUARE: [10, 50, 50],
  TRIANGLE: [50, 60, 50],
  SAWTOOTH: [30, 50, 50],
};

const oscTypes = {
  circle: {
    color: COLORS.CIRCLE,
    waveType: "sine",
    renderShape: (size) => {
      const r = Math.sqrt(size / Math.PI);
      ellipse(0, 0, r * 2, r * 2);
    },
  },
  square: {
    color: COLORS.SQUARE,
    waveType: "square",
    renderShape: (size) => {
      const sideL = sqrt(size);
      rectMode(CENTER);
      rect(0, 0, sideL, sideL);
    },
  },
  triangle: {
    color: COLORS.TRIANGLE,
    waveType: "triangle",
    renderShape: (size) => {
      const sideL = Math.sqrt((size * 4) / Math.sqrt(3));
      const offset = sideL / 10;
      const h = (-sideL * Math.sqrt(3)) / 2;
      beginShape();
      vertex(0, h / 2 - offset);
      vertex(sideL / 2, -h / 2 - offset);
      vertex(-sideL / 2, -h / 2 - offset);
      endShape(CLOSE);
    },
  },
  sawtooth: {
    color: COLORS.SAWTOOTH,
    waveType: "sawtooth",
    renderShape: (size) => {
      const baseL = Math.sqrt(size) * 2;
      const offset = baseL / 14;

      beginShape();
      vertex(-baseL / 2, -baseL / 4 - offset);
      vertex(-baseL / 2, baseL / 2 - baseL / 4 - offset);
      vertex(baseL / 2, baseL / 2 - baseL / 4 - offset);
      endShape(CLOSE);
    },
  },
};

/* 
 ================================================
 ================================================
 ================================================
*/
function OscillatorShape({ harmonicIndex, xPos, initialSize, type }) {
  const { renderShape, color, waveType } = oscTypes[type];
  const yPos = sectionHeight * harmonicIndex + hOffset;
  const pos = createVector(xPos, yPos);
  let count = 0;
  let size = initialSize;
  let isHovered = false;
  let xAmplitude = 0;
  let dragStartPos = pos;
  let tickDivisions = 4;

  const fundamental = musicScale.get(1).fq();

  const osc = new Tone.Oscillator({
    frequency: fundamental * (numHarmonics - harmonicIndex + 1),
    type: waveType,
    volume: -Infinity,
  });

  const vibrato = new Tone.Vibrato({
    frequency: 0.5,
    depth: 0,
  });

  const filter = new Tone.Filter({ type: "lowpass", frequency: 15000 });

  const getVolume = () => map(size, MIN_SIZE, MAX_SIZE, -30, 0);
  const setXPos = (x) => {
    pos.x = x;
    filter.frequency.rampTo(pow(2, map(pos.x, 0, width, 6, 12)), 0.1);
  };

  const setHarmonic = (harmonicIndex) => {
    pos.y = sectionHeight * harmonicIndex + hOffset;
    osc.set({ frequency: fundamental * (numHarmonics - harmonicIndex + 1) });
  };

  osc.chain(vibrato, filter, OUTPUT_NODE);
  osc.start();
  osc.volume.rampTo(getVolume(), 0.1);
  this.getIsHovered = () => {
    let hoverRadius = Math.sqrt(size / Math.PI) * 1.5;
    hoverRadius = max(10, hoverRadius);
    return dist(mouseX, mouseY, pos.x, pos.y) < hoverRadius;
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
    dragStartTickDivisions = tickDivisions;
  };

  this.handleDrag = () => {
    const deltaX = mouseX - dragStartPos.x;
    const deltaY = dragStartPos.y - mouseY;
    if (keyIsDown(SHIFT)) {
      size = dragStartSize + deltaY * 100;
      size = constrain(size, MIN_SIZE, MAX_SIZE);
      osc.volume.rampTo(getVolume(), 0.1);
    } else if (keyIsDown(ALT)) {
      xAmplitude = dragStartXAmplitude + deltaX;
      xAmplitude = constrain(xAmplitude, 0, width / 2);
      tickDivisions = dragStartTickDivisions + deltaY / 5;
      tickDivisions = constrain(tickDivisions, 2, 20);
      vibrato.depth.value = map(xAmplitude, 0, width / 2, 0, 1);
    } else {
      setXPos(mouseX);
      if (hoveredHarmonic > -1) {
        setHarmonic(hoveredHarmonic);
      }
    }
  };

  this.show = () => {
    const [h, s, l] = color;
    const light = isHovered ? l * 1.3 : l;
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
      strokeWeight(4);
    }
    fill(h, sat, light, 0);
    renderShape(size);
    canv.drawingContext.setLineDash([]);
    pop();

    // moving dot
    push();
    //replace with data from oscillator
    translate(pos.x + sin((count * tickDivisions) / 100) * xAmplitude, pos.y);
    stroke(h, sat, light * 1.2);
    fill(h, sat, light, isHovered ? 0.5 : 1);
    renderShape(size);
    pop();

    fill(h, sat, light);
    noStroke();
    rectMode(CENTER);
    count++;

    // colored bar
    push();
    translate(pos.x, pos.y);
    if (isHovered && keyIsDown(ALT)) {
      scale(1, 1.6);
    }
    rect(0, 0, xAmplitude * 2, harmonicIndex);
    rect(xAmplitude, 0, 2, harmonicIndex + 10);
    rect(-xAmplitude, 0, 2, harmonicIndex + 10);
    for (
      let i = -xAmplitude;
      i < xAmplitude;
      i += xAmplitude / (tickDivisions / 2)
    ) {
      fill(h, sat, light);
      noStroke();
      rectMode(CENTER);
      rect(i, 0, 2, harmonicIndex + 6);
    }
    pop();
  };
}

function setup() {
  canv = createCanvas(800, 900);
  inputHeight = height - 200;
  sectionHeight = (inputHeight * 0.8) / numHarmonics;
  colorMode(HSL);
}

function draw() {
  background(0, 0, 14, 1);
  // noFill();
  // stroke(0, 0, 15, 1);
  // strokeWidth();
  let isAnyHovered = false;

  for (let i = numHarmonics; i > 0; i--) {
    const y = sectionHeight * i + hOffset;
    stroke(0, 0, 50, 0.9);
    strokeWeight(i);

    if (!someShapeIsHovered && abs(y - mouseY) < sectionHeight / 2) {
      hoveredHarmonic = i;
      isAnyHovered = true;
    }
    line(0, y, width, y);
  }

  oscillatorShapes.forEach((shape) => {
    shape.show();
  });

  if (!isAnyHovered) {
    hoveredHarmonic = -1;
  }

  if (hoveredShapeIndex === -1 && hoveredHarmonic > -1) {
    const { renderShape, color } = oscTypes[activeShape];
    push();
    strokeWeight(2);
    translate(mouseX, sectionHeight * hoveredHarmonic + hOffset);
    stroke(color[0], color[1], color[2] * 1.2);
    fill(...color, 0.9);
    renderShape(activeSize);
    pop();
  }

  push();
  translate(width / 2, height - 130);
  fill(0, 0, 10, 1);
  noStroke();
  ellipse(0, 0, 220);
  strokeWeight(1);
  stroke(160, 30, 40, 0.5);
  noFill();
  beginShape();

  let waveform = analyzer.getValue();
  let theta = 0;

  for (let i = 0; i < SAMPLE_RATE; i++) {
    let val = map(waveform[i], -1, 1, 0, 100);
    vertex(cos(theta) * val, sin(theta) * val);
    theta += 360 / SAMPLE_RATE;
  }

  endShape();
  pop();
}

function mouseMoved() {
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
  console.log("mouseDragged fireds");
  if (hoveredShapeIndex > -1) {
    oscillatorShapes[hoveredShapeIndex].handleDrag();
  }
}

function mousePressed() {
  if (hoveredShapeIndex > -1) {
    oscillatorShapes[hoveredShapeIndex].handleDragStart(
      createVector(mouseX, mouseY)
    );
    return;
  }

  if (hoveredHarmonic > -1) {
    oscillatorShapes.push(
      new OscillatorShape({
        harmonicIndex: hoveredHarmonic,
        xPos: mouseX,
        initialSize: activeSize,
        type: activeShape,
      })
    );
  }
}

function keyPressed() {
  if (key === "1") {
    activeShape = "circle";
  }
  if (key === "2") {
    activeShape = "square";
  }
  if (key === "3") {
    activeShape = "triangle";
  }
  if (key === "4") {
    activeShape = "sawtooth";
  }
}
