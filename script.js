const CONFIG = {
  rows: 9,
  cols: 7,
  minChain: 3,
  roundTime: 60,
  maxRemainingTime: 90,
  basePoints: 90,
  chainBonus: 40,
  dropDelayMs: 240,
  clearDelayMs: 280,
  feverDurationSeconds: 10,
  timeBonusSeconds: 10,
  pieceScale: 1.06,
  visualJitterX: 0.06,
  visualJitterY: 0.06,
  visualRowWave: 0.05,
  defaultActiveCharacterPoolSize: 5,
  boostedPoolReduction: 1,
};

const CHARACTER_TYPES = [
  { id: "chevry", label: "Chevry", accent: "#54b6ff", src: "./assets/characters/chevry.png" },
  { id: "davry", label: "Davry", accent: "#9fd739", src: "./assets/characters/davry.png" },
  { id: "jivry", label: "Jivry", accent: "#ff7fab", src: "./assets/characters/jivry.png" },
  { id: "jonvry", label: "Jonvry", accent: "#9462e7", src: "./assets/characters/jonvry.png" },
  { id: "mivry", label: "Mivry", accent: "#ffc631", src: "./assets/characters/mivry.png" },
  { id: "movry", label: "Movry", accent: "#57d7c6", src: "./assets/characters/movry.png" },
  { id: "navry", label: "Navry", accent: "#f3dcb2", src: "./assets/characters/navry.png" },
  { id: "savry", label: "Savry", accent: "#ff3947", src: "./assets/characters/savry.png" },
  { id: "tsuvry", label: "Tsuvry", accent: "#1563d8", src: "./assets/characters/tsuvry.png" },
];

const HIGH_SCORE_STORAGE_KEY = "loveryTsumHighScores";

class PersonalRankingStore {
  // Ranking storage is kept separate from gameplay so replay/reset logic stays simple.
  loadScores() {
    try {
      const raw = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((value) => Number.isFinite(value) && value >= 0)
        .map((value) => Math.floor(value))
        .sort((a, b) => b - a)
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  saveScores(scores) {
    const sanitized = scores
      .filter((value) => Number.isFinite(value) && value >= 0)
      .map((value) => Math.floor(value))
      .sort((a, b) => b - a)
      .slice(0, 3);

    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
  }

  updateTop3(finalScore) {
    if (!Number.isFinite(finalScore) || finalScore < 0) {
      return this.loadScores();
    }

    return this.saveScores([...this.loadScores(), Math.floor(finalScore)]);
  }

  clearScores() {
    window.localStorage.removeItem(HIGH_SCORE_STORAGE_KEY);
    return [];
  }
}

class SoundHooks {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.normalBgm = new Audio("./assets/audio/bgm.mp3");
    this.boosterBgm = new Audio("./assets/audio/5-4.mp3");
    this.activeBgm = this.normalBgm;
    this.currentBgmMode = "normal";
    this.bgmPrepared = false;

    [this.normalBgm, this.boosterBgm].forEach((audio) => {
      audio.preload = "auto";
      audio.loop = true;
      audio.volume = 0.06;
    });
  }

  unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    if (!this.context) {
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.22;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      this.context.resume();
    }

    // Browser autoplay policy requires audio to be prepared from a user gesture,
    // but reloading every pointer event would interrupt the currently playing BGM.
    if (!this.bgmPrepared) {
      this.normalBgm.load();
      this.boosterBgm.load();
      this.bgmPrepared = true;
    }
  }

  play(name) {
    if (!this.context || !this.masterGain) {
      return;
    }

    const now = this.context.currentTime;

    if (name === "select") {
      this.playTone(now, 760, 0.05, "sine", 0.07, 930);
      return;
    }

    if (name === "extend") {
      this.playTone(now, 880, 0.045, "triangle", 0.05, 1040);
      return;
    }

    if (name === "backtrack") {
      this.playTone(now, 620, 0.045, "triangle", 0.05, 540);
      return;
    }

    if (name === "invalid") {
      this.playTone(now, 290, 0.06, "square", 0.035, 230);
      return;
    }

    if (name === "clear") {
      this.playTone(now, 620, 0.12, "triangle", 0.18, 760);
      this.playTone(now + 0.024, 860, 0.14, "sine", 0.16, 1120);
      this.playTone(now + 0.052, 1180, 0.12, "sine", 0.12, 1460);
      this.playTone(now + 0.072, 920, 0.16, "triangle", 0.08, 720);
      return;
    }

    if (name === "booster") {
      this.playTone(now, 460, 0.24, "triangle", 0.18, 980);
      this.playTone(now + 0.04, 760, 0.38, "sine", 0.16, 1820);
      this.playTone(now + 0.11, 1080, 0.56, "triangle", 0.13, 2580);
      return;
    }

    if (name === "drop") {
      this.playTone(now, 410, 0.09, "triangle", 0.05, 310);
      this.playTone(now + 0.03, 520, 0.08, "sine", 0.04, 380);
    }
  }

  playTone(startTime, frequency, duration, type, volume, endFrequency = frequency) {
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  switchBgm(mode = "normal", restart = false) {
    const nextBgm = mode === "booster" ? this.boosterBgm : this.normalBgm;
    const shouldResume = restart || !this.activeBgm.paused;

    if (this.activeBgm !== nextBgm) {
      this.activeBgm.pause();
      if (restart) {
        nextBgm.currentTime = 0;
      }
      this.activeBgm = nextBgm;
      this.currentBgmMode = mode;
    } else if (restart) {
      this.activeBgm.currentTime = 0;
    }

    if (shouldResume) {
      this.activeBgm.play().catch(() => {});
    }
  }

  startBgm(mode = "normal") {
    this.switchBgm(mode, true);
  }

  playBoosterBgm() {
    this.switchBgm("booster");
  }

  playNormalBgm() {
    this.switchBgm("normal");
  }

  stopBgm(reset = false) {
    this.normalBgm.pause();
    this.boosterBgm.pause();
    if (reset) {
      this.normalBgm.currentTime = 0;
      this.boosterBgm.currentTime = 0;
    }
    this.activeBgm = this.normalBgm;
    this.currentBgmMode = "normal";
  }
}

class TsumGame {
  constructor() {
    this.boardFrame = document.querySelector(".board-frame");
    this.boardElement = document.getElementById("board");
    this.snowLayer = document.getElementById("snowLayer");
    this.piecesLayer = document.getElementById("piecesLayer");
    this.particleLayer = document.getElementById("particleLayer");
    this.trailCanvas = document.getElementById("trailCanvas");
    this.floatingTextLayer = document.getElementById("floatingText");
    this.boardMessage = document.getElementById("boardMessage");
    this.startOverlay = document.getElementById("startOverlay");
    this.scoreElement = document.getElementById("score");
    this.timerElement = document.getElementById("timer");
    this.finalScoreElement = document.getElementById("finalScore");
    this.rankingList = document.getElementById("rankingList");
    this.startButton = document.getElementById("startButton");
    this.heartBoosterIcon = document.getElementById("heartBoosterIcon");
    this.overlayRestartButton = document.getElementById("overlayRestartButton");
    this.clearRankingButton = document.getElementById("clearRankingButton");
    this.gameOverOverlay = document.getElementById("gameOverOverlay");
    this.audio = new SoundHooks();
    this.rankingStore = new PersonalRankingStore();
    this.imageLoaded = false;
    this.resizeObserver = null;
    this.animationLock = false;
    this.gameActive = false;
    this.pendingGameOver = false;
    this.timerInterval = null;
    this.endAt = 0;
    this.score = 0;
    this.board = [];
    this.selectedChain = [];
    this.selectedType = null;
    this.pointerActive = false;
    this.pointerId = null;
    this.cellSize = 0;
    this.boardMetrics = { width: 0, height: 0, offsetX: 0, offsetY: 0 };
    this.nextPieceId = 1;
    this.gameSessionId = 0;
    this.totalCharacterTypeCount = CHARACTER_TYPES.length;
    this.activeCharacterPoolSize = this.getDefaultActiveCharacterPoolSize();
    this.baseRunTypeIndices = this.buildActiveTypePool(this.activeCharacterPoolSize);
    this.activeTypeIndices = [...this.baseRunTypeIndices];
    this.boosterEffectEndsAt = 0;
    this.boosterPoolSize = this.getBoostedActiveCharacterPoolSize();
    this.boosterReducedTypeIndices = [];

    this.bindEvents();
    this.resetUI();
    this.setupSnowfall();
    this.setupResizeHandling();
    this.preloadCharacterImages();
  }

  setupSnowfall() {
    if (!this.snowLayer) {
      return;
    }

    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const flakeCount = isCoarsePointer ? 18 : 28;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < flakeCount; index += 1) {
      const flake = document.createElement("span");
      flake.className = "snowflake";
      flake.style.setProperty("--left", `${6 + Math.random() * 88}%`);
      flake.style.setProperty("--size", `${2 + Math.random() * 3.4}px`);
      flake.style.setProperty("--opacity", `${0.24 + Math.random() * 0.44}`);
      flake.style.setProperty("--duration", `${6.6 + Math.random() * 3.8}s`);
      flake.style.setProperty("--duration-mobile", `${6.2 + Math.random() * 2.6}s`);
      flake.style.setProperty("--delay", `${Math.random() * -10}s`);
      fragment.appendChild(flake);
    }

    this.snowLayer.innerHTML = "";
    this.snowLayer.appendChild(fragment);
  }

  bindEvents() {
    this.startButton.addEventListener("click", () => {
      this.audio.unlock();
      this.startGame();
    });

    this.overlayRestartButton.addEventListener("click", () => {
      this.audio.unlock();
      this.restartGame();
    });

    this.clearRankingButton.addEventListener("click", () => {
      const clearedScores = this.rankingStore.clearScores();
      this.renderRanking(clearedScores);
    });

    this.boardElement.addEventListener("pointerdown", (event) => {
      this.audio.unlock();
      this.handlePointerDown(event);
    });
    this.boardElement.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.boardElement.addEventListener("pointerup", (event) => this.handlePointerUp(event));
    this.boardElement.addEventListener("pointercancel", (event) => this.handlePointerUp(event));
    this.boardElement.addEventListener("pointerleave", (event) => this.handlePointerLeave(event));
    window.addEventListener("resize", () => this.measureBoard());
  }

  preloadCharacterImages() {
    this.startButton.disabled = true;
    this.toggleStartOverlay(true);
    this.setBoardMessage("画像を準備中...", true);
    this.setBoardMessage("画像を準備中...", true);
    this.setBoardMessage("LOVERY画像を準備中...", true);

    this.setBoardMessage("Loading...", true);

    let loadedCount = 0;
    const finishLoading = () => {
      loadedCount += 1;
      if (loadedCount === CHARACTER_TYPES.length) {
        this.imageLoaded = true;
        this.startButton.disabled = false;
        this.setBoardMessage("", false);
        return;
        this.setBoardMessage("Start を押して LOVERY をつなごう", true);
      }
    };

    CHARACTER_TYPES.forEach((type) => {
      const image = new Image();
      image.onload = finishLoading;
      image.onerror = finishLoading;
      image.src = type.src;
    });
  }

  setupResizeHandling() {
    this.measureBoard();

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => this.measureBoard());
      this.resizeObserver.observe(this.boardElement);
    }
  }

  resetUI() {
    this.scoreElement.textContent = "0";
    this.timerElement.textContent = String(CONFIG.roundTime);
    this.finalScoreElement.textContent = "0";
    this.renderRanking();
    this.toggleStartOverlay(true);
    this.toggleOverlay(false);
    this.drawTrail();
  }

  getDefaultActiveCharacterPoolSize() {
    return Math.min(CONFIG.defaultActiveCharacterPoolSize, this.totalCharacterTypeCount);
  }

  getBoostedActiveCharacterPoolSize() {
    return Math.max(1, this.getDefaultActiveCharacterPoolSize() - CONFIG.boostedPoolReduction);
  }

  applyRunCharacterPool(poolSize) {
    this.activeCharacterPoolSize = Math.max(1, Math.min(poolSize, this.totalCharacterTypeCount));
    this.baseRunTypeIndices = this.buildActiveTypePool(this.activeCharacterPoolSize);
    this.activeTypeIndices = [...this.baseRunTypeIndices];
    this.boosterPoolSize = Math.max(1, Math.min(this.getBoostedActiveCharacterPoolSize(), this.baseRunTypeIndices.length));
    this.boosterReducedTypeIndices = [];
  }

  buildActiveTypePool(poolSize) {
    const indices = Array.from({ length: this.totalCharacterTypeCount }, (_, index) => index);

    for (let index = indices.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
    }

    return indices.slice(0, poolSize);
  }

  getRandomActiveTypeIndex() {
    const pool = this.activeTypeIndices.length ? this.activeTypeIndices : [0];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  activateTemporaryBooster(durationSeconds) {
    const targetPoolSize = Math.max(1, Math.min(this.boosterPoolSize, this.baseRunTypeIndices.length));
    if (targetPoolSize >= this.baseRunTypeIndices.length) {
      return;
    }

    const shuffled = [...this.baseRunTypeIndices];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    this.boosterReducedTypeIndices = shuffled.slice(0, targetPoolSize);
    this.activeTypeIndices = [...this.boosterReducedTypeIndices];
    this.boosterEffectEndsAt = Date.now() + durationSeconds * 1000;
    this.boardFrame?.classList.add("board-fever");
    this.boardElement.classList.add("board-fever");
    this.heartBoosterIcon.classList.remove("hidden");
    this.heartBoosterIcon.setAttribute("aria-hidden", "false");
    if (this.gameActive) {
      this.audio.playBoosterBgm();
    }
    this.audio.play("booster");
  }

  normalizeBoardToActivePool() {
    if (!this.activeTypeIndices.length) {
      return;
    }

    const allowedTypes = new Set(this.activeTypeIndices);
    let updated = false;

    for (let row = 0; row < CONFIG.rows; row += 1) {
      for (let col = 0; col < CONFIG.cols; col += 1) {
        const piece = this.board[row][col];
        if (!piece || allowedTypes.has(piece.typeIndex)) {
          continue;
        }

        piece.typeIndex = this.getRandomActiveTypeIndex();
        updated = true;
      }
    }

    if (updated) {
      this.renderBoard(true);
    }
  }

  updateTemporaryBoosterEffect() {
    if (!this.boosterEffectEndsAt) {
      return;
    }

    if (Date.now() >= this.boosterEffectEndsAt) {
      this.clearTemporaryBoosterEffect();
    }
  }

  isTemporaryBoosterActive() {
    return this.boosterEffectEndsAt > Date.now();
  }

  clearTemporaryBoosterEffect() {
    this.boosterEffectEndsAt = 0;
    this.boosterReducedTypeIndices = [];
    this.activeTypeIndices = [...this.baseRunTypeIndices];
    this.boardFrame?.classList.remove("board-fever");
    this.boardElement.classList.remove("board-fever");
    this.heartBoosterIcon.classList.add("hidden");
    this.heartBoosterIcon.setAttribute("aria-hidden", "true");
    if (this.gameActive) {
      this.audio.playNormalBgm();
    }
  }

  addTimeBonus(seconds) {
    const now = Date.now();
    const maxEndAt = now + CONFIG.maxRemainingTime * 1000;
    const nextEndAt = Math.min(maxEndAt, this.endAt + seconds * 1000);
    const appliedBonusMs = Math.max(0, nextEndAt - this.endAt);
    this.endAt = nextEndAt;
    this.updateTimer();
    return appliedBonusMs;
  }

  startGame() {
    if (!this.imageLoaded || this.gameActive) {
      return;
    }

    this.initializeGameState(this.getDefaultActiveCharacterPoolSize());
    this.gameActive = true;
    this.startButton.disabled = true;
    this.toggleStartOverlay(false);
    this.setBoardMessage("", false);
    this.toggleOverlay(false);
    this.audio.startBgm();
    this.startTimer();
  }

  restartGame() {
    if (!this.imageLoaded) {
      return;
    }

    this.audio.stopBgm(true);
    this.stopTimer();
    this.endPointerDrag();
    this.animationLock = false;
    this.gameActive = false;
    this.startButton.disabled = true;
    this.toggleStartOverlay(false);
    this.toggleOverlay(false);
    this.setBoardMessage("", false);
    this.initializeGameState(this.getDefaultActiveCharacterPoolSize());
    this.gameActive = true;
    this.audio.startBgm();
    this.startTimer();
  }

  initializeGameState(runPoolSize = this.getDefaultActiveCharacterPoolSize()) {
    this.gameSessionId += 1;
    this.score = 0;
    this.nextPieceId = 1;
    this.pendingGameOver = false;
    this.selectedChain = [];
    this.selectedType = null;
    this.pointerActive = false;
    this.animationLock = false;
    this.clearParticles();
    this.clearFloatingEffects();
    this.applyRunCharacterPool(runPoolSize);
    this.clearTemporaryBoosterEffect();

    this.board = Array.from({ length: CONFIG.rows }, (_, row) =>
      Array.from({ length: CONFIG.cols }, (_, col) => this.createPiece(row, col))
    );

    this.updateScore(0);
    this.renderBoard(true);
    this.measureBoard();
  }

  createPiece(row, col, forcedType = null, options = {}) {
    const typeIndex = forcedType ?? this.getRandomActiveTypeIndex();
    const visual = this.createVisualProfile(row, col);
    return {
      id: this.nextPieceId++,
      typeIndex,
      row,
      col,
      spawnFromRow: options.spawnFromRow ?? null,
      renderOffsetX: visual.x,
      renderOffsetY: visual.y,
      renderTilt: visual.tilt,
      bobDuration: visual.bobDuration,
      bobDelay: visual.bobDelay,
      bobOffset: visual.bobOffset,
    };
  }

  createVisualProfile(row, col) {
    const seed = this.nextPieceId * 97 + row * 31 + col * 17;
    const randomA = this.seededValue(seed);
    const randomB = this.seededValue(seed + 1);
    const randomC = this.seededValue(seed + 2);
    const randomD = this.seededValue(seed + 3);
    const randomE = this.seededValue(seed + 4);
    const rowWave = ((row % 2 === 0 ? -1 : 1) * CONFIG.visualRowWave) + (randomA - 0.5) * 0.06;

    return {
      x: (rowWave + (randomB - 0.5) * CONFIG.visualJitterX) * this.cellSize,
      y: ((randomC - 0.5) * CONFIG.visualJitterY) * this.cellSize,
      tilt: (randomD - 0.5) * 3.2,
      bobDuration: 4.2 + randomE * 1.8,
      bobDelay: -randomB * 2.6,
      bobOffset: 0.6 + randomC * 1.2,
    };
  }

  seededValue(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  startTimer() {
    this.stopTimer();
    this.endAt = Date.now() + CONFIG.roundTime * 1000;
    this.updateTimer();
    this.timerInterval = window.setInterval(() => this.updateTimer(), 100);
  }

  stopTimer() {
    if (this.timerInterval) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimer() {
    const remainingMs = Math.max(0, this.endAt - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    this.timerElement.textContent = String(remainingSeconds);
    this.updateTemporaryBoosterEffect();

    if (remainingMs <= 0) {
      if (this.animationLock) {
        this.pendingGameOver = true;
      } else {
        this.finishGame();
      }
    }
  }

  finishGame() {
    if (!this.gameActive) {
      return;
    }

    this.stopTimer();
    this.audio.stopBgm(true);
    this.endPointerDrag();
    this.gameActive = false;
    this.startButton.disabled = false;
    this.toggleStartOverlay(false);
    this.clearTemporaryBoosterEffect();
    const highScores = this.rankingStore.updateTop3(this.score);
    this.finalScoreElement.textContent = this.score.toLocaleString("ja-JP");
    this.renderRanking(highScores);
    this.toggleOverlay(true);
    this.setBoardMessage("", false);
    return;
    this.setBoardMessage("LOVERY をもう一回つなごう", true);
  }

  toggleOverlay(show) {
    this.gameOverOverlay.classList.toggle("hidden", !show);
    this.gameOverOverlay.setAttribute("aria-hidden", String(!show));
  }

  toggleStartOverlay(show) {
    this.startOverlay.classList.toggle("hidden", !show);
    this.startOverlay.setAttribute("aria-hidden", String(!show));
  }

  setBoardMessage(text, show) {
    const message = this.boardMessage.querySelector("p");
    message.textContent = text;
    this.boardMessage.classList.toggle("hidden", !show);
  }

  updateScore(delta) {
    this.score += delta;
    this.scoreElement.textContent = this.score.toLocaleString("ja-JP");
  }

  renderRanking(scores = this.rankingStore.loadScores()) {
    if (!this.rankingList) {
      return;
    }

    const labels = ["1st", "2nd", "3rd"];
    this.rankingList.innerHTML = "";

    if (!scores.length) {
      const emptyState = document.createElement("li");
      emptyState.className = "ranking-empty";
      emptyState.textContent = "No scores yet";
      this.rankingList.appendChild(emptyState);
      return;
    }

    labels.forEach((label, index) => {
      const item = document.createElement("li");
      item.className = "ranking-item";

      const rank = document.createElement("span");
      rank.className = "ranking-label";
      rank.textContent = `${label}:`;

      const value = document.createElement("strong");
      value.className = "ranking-value";
      value.textContent = scores[index] !== undefined ? scores[index].toLocaleString("ja-JP") : "---";

      item.append(rank, value);
      this.rankingList.appendChild(item);
    });
  }

  handlePointerDown(event) {
    if (!this.gameActive || this.animationLock) {
      return;
    }

    const piece = this.findPieceFromPoint(event.clientX, event.clientY);
    if (!piece) {
      return;
    }

    event.preventDefault();
    this.pointerActive = true;
    this.pointerId = event.pointerId;
    this.boardElement.setPointerCapture?.(event.pointerId);
    this.beginChain(piece);
  }

  handlePointerMove(event) {
    if (!this.pointerActive || event.pointerId !== this.pointerId || this.animationLock) {
      return;
    }

    event.preventDefault();
    const piece = this.findPieceFromPoint(event.clientX, event.clientY);
    if (!piece) {
      this.drawTrail(event.clientX, event.clientY);
      return;
    }

    this.extendChain(piece);
    this.drawTrail(event.clientX, event.clientY);
  }

  handlePointerUp(event) {
    if (!this.pointerActive || event.pointerId !== this.pointerId) {
      return;
    }

    event.preventDefault();
    this.endPointerDrag();
    this.resolveChain();
  }

  handlePointerLeave(event) {
    if (!this.pointerActive || event.pointerId !== this.pointerId) {
      return;
    }

    this.drawTrail(event.clientX, event.clientY);
  }

  endPointerDrag() {
    if (this.pointerId !== null && this.boardElement.hasPointerCapture?.(this.pointerId)) {
      this.boardElement.releasePointerCapture(this.pointerId);
    }

    this.pointerActive = false;
    this.pointerId = null;
    this.drawTrail();
  }

  beginChain(piece) {
    this.selectedChain = [piece];
    this.selectedType = piece.typeIndex;
    this.refreshSelectionState();
    this.audio.play("select");
    this.drawTrail();
  }

  extendChain(piece) {
    if (piece.typeIndex !== this.selectedType) {
      this.audio.play("invalid");
      this.bumpInvalidPiece(piece.id);
      return;
    }

    const lastPiece = this.selectedChain[this.selectedChain.length - 1];
    if (lastPiece && lastPiece.id === piece.id) {
      return;
    }

    if (
      this.selectedChain.length > 1 &&
      this.selectedChain[this.selectedChain.length - 2].id === piece.id
    ) {
      this.selectedChain.pop();
      this.refreshSelectionState();
      this.audio.play("backtrack");
      return;
    }

    if (this.selectedChain.some((item) => item.id === piece.id)) {
      return;
    }

    if (!this.isAdjacent(lastPiece, piece)) {
      this.audio.play("invalid");
      this.bumpInvalidPiece(piece.id);
      return;
    }

    this.selectedChain.push(piece);
    this.refreshSelectionState();
    this.audio.play("extend");
  }

  async resolveChain() {
    if (this.selectedChain.length < CONFIG.minChain || !this.gameActive) {
      this.clearSelection();
      return;
    }

    this.updateTemporaryBoosterEffect();
    const sessionId = this.gameSessionId;
    const boosterWasActive = this.isTemporaryBoosterActive();
    this.animationLock = true;
    const clearedPieces = [...this.selectedChain];
    const chainLength = clearedPieces.length;
    const scoreMultiplier = this.getScoreMultiplier(chainLength, boosterWasActive);
    const earned = this.calculateScore(chainLength, scoreMultiplier);
    const type = CHARACTER_TYPES[clearedPieces[0].typeIndex];

    this.audio.play("clear");
    this.flashBoard(type.accent, chainLength);
    this.popPieces(clearedPieces);
    this.spawnBursts(clearedPieces, type.accent);
    this.showFloatingText(
      `${this.getFeedbackText(chainLength)} +${earned}${this.getMultiplierLabel(scoreMultiplier)}`,
      type.accent
    );

    if (!boosterWasActive && chainLength >= 6) {
      const appliedBonusMs = this.addTimeBonus(CONFIG.timeBonusSeconds);
      if (appliedBonusMs > 0) {
        this.showFloatingImage("./assets/images/plus10.png");
      }
    }

    await this.wait(CONFIG.clearDelayMs);

    if (sessionId !== this.gameSessionId) {
      return;
    }

    clearedPieces.forEach((piece) => {
      this.board[piece.row][piece.col] = null;
    });

    this.clearSelection();
    this.updateScore(earned);

    if (!boosterWasActive && chainLength >= 7) {
      this.activateTemporaryBooster(CONFIG.feverDurationSeconds);
    }

    this.collapseBoard();
    this.normalizeBoardToActivePool();
    this.renderBoard();
    this.audio.play("drop");

    await this.wait(CONFIG.dropDelayMs);

    if (sessionId !== this.gameSessionId) {
      return;
    }

    this.animationLock = false;
    if (this.pendingGameOver) {
      this.finishGame();
    }
  }

  clearSelection() {
    this.selectedChain = [];
    this.selectedType = null;
    this.refreshSelectionState();
    this.drawTrail();
  }

  refreshSelectionState() {
    this.piecesLayer.querySelectorAll(".piece.selected").forEach((element) => {
      element.classList.remove("selected");
      element.style.zIndex = String(2 + Number(element.dataset.row || 0));
    });

    this.selectedChain.forEach((piece, index) => {
      const element = this.piecesLayer.querySelector(`[data-piece-id="${piece.id}"]`);
      if (element) {
        element.classList.add("selected");
        element.style.zIndex = String(8 + index);
      }
    });

    this.drawTrail();
  }

  popPieces(pieces) {
    pieces.forEach((piece) => {
      const element = this.piecesLayer.querySelector(`[data-piece-id="${piece.id}"]`);
      if (element) {
        element.classList.add("popping");
      }
    });
  }

  collapseBoard() {
    const nextBoard = Array.from({ length: CONFIG.rows }, () => Array(CONFIG.cols).fill(null));

    for (let col = 0; col < CONFIG.cols; col += 1) {
      const remaining = [];
      for (let row = CONFIG.rows - 1; row >= 0; row -= 1) {
        const piece = this.board[row][col];
        if (piece) {
          remaining.push(piece);
        }
      }

      let targetRow = CONFIG.rows - 1;
      for (const piece of remaining) {
        piece.row = targetRow;
        piece.col = col;
        nextBoard[targetRow][col] = piece;
        targetRow -= 1;
      }

      let spawnOffset = 0;
      while (targetRow >= 0) {
        spawnOffset += 1;
        nextBoard[targetRow][col] = this.createPiece(targetRow, col, null, {
          spawnFromRow: -spawnOffset,
        });
        targetRow -= 1;
      }
    }

    this.board = nextBoard;
  }

  calculateScore(chainLength, multiplier = 1) {
    const baseScore = (
      CONFIG.basePoints * chainLength +
      Math.max(0, chainLength - CONFIG.minChain) * CONFIG.chainBonus
    );

    return Math.round(baseScore * multiplier);
  }

  getScoreMultiplier(chainLength, boosterWasActive) {
    if (chainLength >= 10) {
      return 2;
    }

    if (boosterWasActive) {
      return 1.3;
    }

    return 1;
  }

  getMultiplierLabel(multiplier) {
    if (multiplier <= 1) {
      return "";
    }

    return ` x${multiplier.toFixed(1)}`;
  }

  getFeedbackText(chainLength) {
    if (chainLength >= 9) {
      return "LOVERY MAX!";
    }
    if (chainLength >= 7) {
      return "Fantastic!";
    }
    if (chainLength >= 5) {
      return "Lovely!";
    }
    if (chainLength >= 4) {
      return "Nice!";
    }
    return "Good!";
  }

  showFloatingText(text, accent) {
    const node = document.createElement("div");
    node.className = "floating-text";
    node.textContent = text;
    node.style.setProperty("--accent", accent);
    this.floatingTextLayer.appendChild(node);
    window.setTimeout(() => node.remove(), 1100);
  }

  showFloatingImage(src) {
    const node = document.createElement("div");
    node.className = "floating-image";
    node.innerHTML = `<img src="${src}" alt="" draggable="false">`;
    this.floatingTextLayer.appendChild(node);
    window.setTimeout(() => node.remove(), 1100);
  }

  clearFloatingEffects() {
    this.floatingTextLayer.innerHTML = "";
  }

  flashBoard(accent, chainLength) {
    this.boardElement.style.setProperty("--burst-color", accent);
    this.boardElement.classList.remove("board-burst", "board-shake");
    void this.boardElement.offsetWidth;
    this.boardElement.classList.add("board-burst");
    if (chainLength >= 7) {
      this.boardElement.classList.add("board-shake");
    }
    window.setTimeout(() => {
      this.boardElement.classList.remove("board-burst", "board-shake");
    }, 420);
  }

  spawnBursts(pieces, accent) {
    pieces.forEach((piece) => {
      const center = this.getPieceCenter(piece);
      const particleCount = 7;
      for (let index = 0; index < particleCount; index += 1) {
        const particle = document.createElement("span");
        particle.className = "particle";
        const angle = (Math.PI * 2 * index) / particleCount + Math.random() * 0.4;
        const distance = this.cellSize * (0.26 + Math.random() * 0.34);
        const driftX = Math.cos(angle) * distance;
        const driftY = Math.sin(angle) * distance;
        const size = 7 + Math.random() * 10;
        particle.style.left = `${center.x}px`;
        particle.style.top = `${center.y}px`;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.setProperty("--accent", accent);
        particle.style.setProperty("--tx", `${driftX}px`);
        particle.style.setProperty("--ty", `${driftY}px`);
        particle.style.setProperty("--rot", `${(Math.random() - 0.5) * 140}deg`);
        this.particleLayer.appendChild(particle);
        window.setTimeout(() => particle.remove(), 700);
      }
    });
  }

  clearParticles() {
    this.particleLayer.innerHTML = "";
  }

  wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  renderBoard(skipIntro = false) {
    const existingElements = new Map(
      [...this.piecesLayer.querySelectorAll(".piece")].map((element) => [Number(element.dataset.pieceId), element])
    );
    const fragment = document.createDocumentFragment();
    const activeIds = new Set();

    for (let row = 0; row < CONFIG.rows; row += 1) {
      for (let col = 0; col < CONFIG.cols; col += 1) {
        const piece = this.board[row][col];
        if (!piece) {
          continue;
        }

        activeIds.add(piece.id);
        let element = existingElements.get(piece.id);
        const isNewElement = !element;
        if (!element) {
          element = this.createPieceElement(piece);
          fragment.appendChild(element);
        }

        this.positionPieceElement(element, piece, skipIntro, isNewElement);
      }
    }

    existingElements.forEach((element, pieceId) => {
      if (!activeIds.has(pieceId)) {
        element.remove();
      }
    });

    this.piecesLayer.appendChild(fragment);
    this.drawTrail();
  }

  createPieceElement(piece) {
    const type = CHARACTER_TYPES[piece.typeIndex];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "piece";
    button.dataset.pieceId = String(piece.id);

    // Future customization point:
    // Swap `type.src` to different local image files if you later replace
    // the current LOVERYS PNGs with updated production character art.
    button.innerHTML = `
      <span class="piece-body">
        <span class="piece-halo"></span>
        <span class="piece-spark"></span>
        <span class="piece-art"><img src="${type.src}" alt="" draggable="false"></span>
      </span>
    `;

    button.style.setProperty("--tilt", `${piece.renderTilt}deg`);
    button.style.setProperty("--bob-duration", `${piece.bobDuration}s`);
    button.style.setProperty("--bob-delay", `${piece.bobDelay}s`);
    button.style.setProperty("--bob-offset", `${piece.bobOffset}px`);
    this.syncPieceElementAppearance(button, piece);

    return button;
  }

  syncPieceElementAppearance(element, piece) {
    const type = CHARACTER_TYPES[piece.typeIndex];
    const image = element.querySelector("img");

    element.dataset.typeIndex = String(piece.typeIndex);
    element.setAttribute("aria-label", `${type.label} piece`);
    element.style.setProperty("--accent", type.accent);

    if (image && image.getAttribute("src") !== type.src) {
      image.setAttribute("src", type.src);
    }
  }

  positionPieceElement(element, piece, skipIntro, isNewElement) {
    const { x, y } = this.renderToPixels(piece.row, piece.col, piece);
    element.dataset.row = String(piece.row);
    element.dataset.col = String(piece.col);
    this.syncPieceElementAppearance(element, piece);
    if (!element.classList.contains("selected")) {
      element.style.zIndex = String(2 + piece.row);
    }

    if (!skipIntro && isNewElement && piece.spawnFromRow !== null) {
      const start = this.renderToPixels(piece.spawnFromRow, piece.col, piece);
      element.style.setProperty("--x", `${start.x}px`);
      element.style.setProperty("--y", `${start.y}px`);
      element.style.setProperty("--scale", "0.92");
      requestAnimationFrame(() => {
        element.style.setProperty("--x", `${x}px`);
        element.style.setProperty("--y", `${y}px`);
        element.style.setProperty("--scale", "1");
      });
      piece.spawnFromRow = null;
      return;
    }

    element.style.setProperty("--x", `${x}px`);
    element.style.setProperty("--y", `${y}px`);
    element.style.setProperty("--scale", "1");
    piece.spawnFromRow = null;
  }

  gridToPixels(row, col) {
    const pieceSize = this.cellSize * CONFIG.pieceScale;
    const x = this.boardMetrics.offsetX + col * this.cellSize + (this.cellSize - pieceSize) / 2;
    const y = this.boardMetrics.offsetY + row * this.cellSize + (this.cellSize - pieceSize) / 2;
    return { x, y };
  }

  renderToPixels(row, col, piece) {
    const base = this.gridToPixels(row, col);
    return {
      x: base.x + (piece?.renderOffsetX ?? 0),
      y: base.y + (piece?.renderOffsetY ?? 0),
    };
  }

  measureBoard() {
    const rect = this.boardElement.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const widthCell = rect.width / CONFIG.cols;
    const heightCell = rect.height / CONFIG.rows;
    this.cellSize = Math.min(widthCell, heightCell);
    const totalWidth = this.cellSize * CONFIG.cols;
    const totalHeight = this.cellSize * CONFIG.rows;

    this.boardMetrics = {
      width: rect.width,
      height: rect.height,
      offsetX: (rect.width - totalWidth) / 2,
      offsetY: (rect.height - totalHeight) / 2,
    };

    this.boardElement.style.setProperty("--cell-size", `${this.cellSize}px`);
    this.resizeCanvas();

    if (this.board.length) {
      this.renderBoard(true);
    }
  }

  resizeCanvas() {
    const rect = this.boardElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.trailCanvas.width = Math.floor(rect.width * ratio);
    this.trailCanvas.height = Math.floor(rect.height * ratio);
    this.trailCanvas.style.width = `${rect.width}px`;
    this.trailCanvas.style.height = `${rect.height}px`;
    const context = this.trailCanvas.getContext("2d");
    if (context) {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    this.drawTrail();
  }

  drawTrail(pointerX = null, pointerY = null) {
    const context = this.trailCanvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, this.boardMetrics.width, this.boardMetrics.height);
    if (!this.selectedChain.length) {
      return;
    }

    const activeType = CHARACTER_TYPES[this.selectedType];
    const centers = this.selectedChain.map((piece) => this.getPieceCenter(piece));
    if (pointerX !== null && pointerY !== null) {
      const rect = this.boardElement.getBoundingClientRect();
      centers.push({ x: pointerX - rect.left, y: pointerY - rect.top });
    }

    context.save();
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = "rgba(255, 255, 255, 0.98)";
    context.shadowColor = activeType?.accent || "rgba(255,255,255,0.8)";
    context.shadowBlur = 22;
    context.lineWidth = Math.max(10, this.cellSize * 0.21);
    context.beginPath();

    centers.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });

    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = activeType?.accent || "rgba(255, 186, 222, 0.7)";
    context.lineWidth = Math.max(4, this.cellSize * 0.08);
    context.stroke();

    centers.slice(0, pointerX === null ? centers.length : -1).forEach((point) => {
      context.beginPath();
      context.fillStyle = activeType?.accent || "white";
      context.arc(point.x, point.y, Math.max(6, this.cellSize * 0.13), 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.fillStyle = "rgba(255, 255, 255, 0.95)";
      context.arc(point.x, point.y, Math.max(2.2, this.cellSize * 0.045), 0, Math.PI * 2);
      context.fill();
    });

    context.restore();
  }

  getPieceCenter(piece) {
    const { x, y } = this.renderToPixels(piece.row, piece.col, piece);
    const size = this.cellSize * CONFIG.pieceScale;
    return { x: x + size / 2, y: y + size / 2 };
  }

  findPieceFromPoint(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    if (!element) {
      return null;
    }

    const pieceElement = element.closest(".piece");
    if (!pieceElement || !this.boardElement.contains(pieceElement)) {
      return null;
    }

    return this.findPieceById(Number(pieceElement.dataset.pieceId));
  }

  findPieceById(pieceId) {
    for (let row = 0; row < CONFIG.rows; row += 1) {
      for (let col = 0; col < CONFIG.cols; col += 1) {
        const piece = this.board[row][col];
        if (piece && piece.id === pieceId) {
          return piece;
        }
      }
    }
    return null;
  }

  isAdjacent(a, b) {
    const rowDiff = Math.abs(a.row - b.row);
    const colDiff = Math.abs(a.col - b.col);
    return rowDiff <= 1 && colDiff <= 1 && (rowDiff !== 0 || colDiff !== 0);
  }

  bumpInvalidPiece(pieceId) {
    const element = this.piecesLayer.querySelector(`[data-piece-id="${pieceId}"]`);
    if (!element) {
      return;
    }

    element.classList.remove("preview-invalid");
    void element.offsetWidth;
    element.classList.add("preview-invalid");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.tsumGame = new TsumGame();
});
