const musicScale = new teoria.note("A1").scale("major");
let activeShape = "circle";
let activeSize = 5000;
const MAX_SIZE = 15000;
const MIN_SIZE = 100;
const X_PAD = 35;
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
      fill(0, 0, 100, 1);
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

const getMousePos = () =>
  createVector(constrain(mouseX, X_PAD, width - X_PAD), mouseY);

const drawCrosshair = () => {
  strokeWeight(2);
  stroke(0, 0, 100, 0.9);
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
    renderShape: (size, useOffset = true) => {
      const sideL = Math.sqrt((size * 4) / Math.sqrt(3));
      const offset = useOffset ? sideL / 10 : 0;
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
    renderShape: (size, useOffset = true) => {
      const baseL = Math.sqrt(size) * 2;
      const offset = useOffset ? baseL / 14 : 0;

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
    depth: 1,
    wet: 1,
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
  setXPos(xPos);

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
    dragStartTickDivisions = tickDivisions;
  };

  this.handleDrag = () => {
    const mousePos = getMousePos();
    const deltaX = mousePos.x - dragStartPos.x;
    const deltaY = dragStartPos.y - mousePos.y;
    if (keyIsDown(SHIFT)) {
      size = dragStartSize + deltaY * 100;
      size = constrain(size, MIN_SIZE, MAX_SIZE);
      osc.volume.rampTo(getVolume(), 0.1);
    } else if (keyIsDown(ALT)) {
      xAmplitude = dragStartXAmplitude + deltaX;
      xAmplitude = constrain(xAmplitude, 0, width / 2);
      tickDivisions = dragStartTickDivisions + deltaY / 15;
      tickDivisions = constrain(tickDivisions, 2, 20);
      vibrato.depth.value = map(xAmplitude, 0, width / 2, 0, 1);
      console.log(vibrato.depth.value);
      vibrato.frequency.value = tickDivisions / 10;
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
    renderShape(size);
    canv.drawingContext.setLineDash([]);
    pop();

    // moving dot
    push();
    //replace with data from oscillator
    translate(pos.x + sin((count * tickDivisions) / 100) * xAmplitude, pos.y);
    stroke(h, sat, light * 1.2);
    fill(h, sat, light, isHovered ? 0.5 : 1);
    // rotate(count / 10);
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
      scale(1, map(sin(count / 5), -1, 1, 1.1, 2));
    }
    rect(0, 0, xAmplitude * 2, harmonicIndex);
    rect(xAmplitude, 0, 4, harmonicIndex + 10);
    rect(-xAmplitude, 0, 4, harmonicIndex + 10);
    for (let i = 0; i < xAmplitude; i += xAmplitude / (tickDivisions / 2)) {
      fill(h, sat, light);
      noStroke();
      rectMode(CENTER);
      rect(i, 0, 2, harmonicIndex + 6);
      rect(-i, 0, 2, harmonicIndex + 6);
    }
    pop();
  };
}

function setup() {
  canv = createCanvas(800, 900);
  inputHeight = height * (2 / 3);
  sectionHeight = (inputHeight * 0.85) / numHarmonics;
  colorMode(HSL);
}

function draw() {
  background(0, 0, 14, 1);
  push();
  fill(0, 0, 16, 1);
  noStroke();
  rectMode(CORNER);
  rect(0, inputHeight, width, height);

  translate(width * 0.22, inputHeight + (height - inputHeight) / 2);
  fill(0, 0, 0, 0.2);
  noStroke();
  ellipse(0, 0, 240);
  ellipse(0, -0, 220);

  pop();

  push();
  translate(width / 2, inputHeight);
  fill(0, 0, 16, 1);
  noStroke();
  rect(0, 0, width, 10);
  pop();
  fill(0, 0, 10, 1);
  noStroke();
  rectMode(CORNER);
  rect(0, 0, width, inputHeight);

  push();
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

  fill(0, 0, 3, 1);
  quad(...outer[0], ...inner[0], ...inner[1], ...outer[1]);

  fill(0, 0, 8, 1);
  quad(...outer[0], ...inner[0], ...inner[3], ...outer[3]);
  quad(...outer[1], ...inner[1], ...inner[2], ...outer[2]);

  fill(0, 0, 12, 1);
  quad(...outer[3], ...inner[3], ...inner[2], ...outer[2]);

  pop();

  let isAnyHovered = false;
  fill(0, 0, 10, 0.2);
  noStroke();
  rectMode(CENTER);
  const w = sectionHeight * (numHarmonics + 1);

  for (let i = numHarmonics; i > 0; i--) {
    const y = sectionHeight * i + hOffset;
    stroke(0, 0, 50, 0.5);
    strokeCap(ROUND);
    strokeWeight(i);

    if (!someShapeIsHovered && abs(y - mouseY) < sectionHeight / 2) {
      hoveredHarmonic = i;
      isAnyHovered = true;
    }
    line(X_PAD, y, width - X_PAD, y);
    strokeWeight(1);
    stroke(0, 0, 100, 0.5);
    strokeCap(ROUND);

    line(X_PAD, y, width - X_PAD, y);
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
    const mousePos = getMousePos();
    translate(mousePos.x, sectionHeight * hoveredHarmonic + hOffset);
    stroke(color[0], color[1], color[2] * 1.2);
    fill(...color, 0.9);
    renderShape(activeSize);
    pop();
  }

  strokeWeight(X_PAD);
  stroke(0, 0, 16, 1);
  noFill();
  rect(width / 2, height / 2, width, height);

  push();

  translate(width * 0.22, inputHeight + (height - inputHeight) / 2);
  strokeWeight(1);

  stroke(160, 30, 100, 0.5);
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

  // Shape controls
  Object.keys(oscTypes).forEach((key, i) => {
    const { renderShape, color } = oscTypes[key];
    const x = width / 2;
    const y = inputHeight + 70;
    const isActive = activeShape === key;
    push();
    translate(x, y);
    translate(i * 108, 0);
    rectMode(CENTER);
    const [h, s, l] = color;
    const borderL = isActive
      ? map(sin(frameCount / 10), -1, 1, l * 1, l * 1.3)
      : l;
    fill(...color, isActive ? 0.2 : 0.1);
    stroke(h, s, borderL, isActive ? 0.9 : 0.1);
    strokeWeight(isActive ? map(sin(frameCount / 10), -1, 1, 3, 5) : 2);
    rect(0, 0, 90, 90);
    fill(...color);
    stroke(...color);
    strokeWeight(2);
    renderShape(700, false);
    strokeWeight(0);
    text(i + 1, -40, -31);
    pop();
  });

  // UI controls

  translate(width / 2, inputHeight + 210);
  dragBehaviorControls.forEach(({ renderLogo, getIsSelected, label }, i) => {
    const isSelected = getIsSelected();
    const rectWidth = 130;
    push();
    translate(i * rectWidth + 20 + i * 11, 0);
    fill(0, 0, 0, isSelected ? 0.2 : 0.1);
    strokeWeight(isSelected ? 2 : 1);
    stroke(0, 0, 100, isSelected ? 0.9 : 0.1);
    rect(0, 0, rectWidth);
    push();
    fill(0, 0, 100, isSelected ? 0.2 : 0.1);
    renderLogo();
    pop();
    if (label) {
      fill(0, 0, 100, 0.9);
      strokeWeight(0);
      text(label, -55, -48);
    }
    pop();
  });
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
    oscillatorShapes[hoveredShapeIndex].handleDragStart(getMousePos());
    return;
  }

  if (hoveredHarmonic > -1) {
    oscillatorShapes.push(
      new OscillatorShape({
        harmonicIndex: hoveredHarmonic,
        xPos: getMousePos().x,
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
