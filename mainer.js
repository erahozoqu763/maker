// ---- Налаштування гри ----
const BASE_RATE = 1e-9;            // SC/сек без зарядки
const BOOST_FACTOR = 100;           // множник під час зарядки
const CHARGE_COST = 50;             // SC за одну зарядку
const CHARGE_DURATION = 600;        // сек роботи при зарядці (5 хв)
const UPGRADE_BASE_COST = 20;      // базова ціна апгрейду
const UPGRADE_COST_MULT = 2;        // множник ціни апгрейду
const MIN_SPIN_SEC = 0.3;           // найшвидший оберт кулера (сек)
const MAX_SPIN_SEC = 6;            // найповільніший оберт кулера (сек)

// ---- Елементи DOM ----
const el = {
    speed: document.getElementById("speed"),
    mined: document.getElementById("mined"),
    balance: document.getElementById("balance"),
    boost: document.getElementById("boost"),
    chargeBtn: document.getElementById("charge"),
    upgradeBtn: document.getElementById("upgrade"),
    fan: document.getElementById("fanImg"),
    chargeBar: document.getElementById("chargeBar")
};

// ---- Стан ----
let state = loadState();
let tickTimer = null;

// ---- Ініціалізація ----
resumeOfflineProgress();
render();
ensureSpinState();
attachHandlers();
startTicker();

// ================== ЛОГІКА ==================
function baseRate() {
    return BASE_RATE * state.upgradeLevel;
}

function effectiveRate(isBoost) {
    return baseRate() * (isBoost ? BOOST_FACTOR : 1);
}

function resumeOfflineProgress() {
    const now = nowSec();
    const last = state.lastTs || now;
    const elapsed = Math.max(0, Math.floor(now - last));
    if (!elapsed) return (state.lastTs = now, saveState());

    const boostLeft = Math.max(0, state.chargeLeft);
    const boostUsed = Math.min(boostLeft, elapsed);
    const idleUsed = elapsed - boostUsed;

    const minedBoost = effectiveRate(true) * boostUsed;
    const minedIdle = effectiveRate(false) * idleUsed;
    const minedTotal = minedBoost + minedIdle;

    state.balance += minedTotal;
    state.minedTotal += minedTotal;
    state.chargeLeft = Math.max(0, boostLeft - elapsed);
    state.lastTs = now;
    saveState();
}

function startTicker() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
        const onBoost = state.chargeLeft > 0;
        const rate = effectiveRate(onBoost);

        state.balance += rate;
        state.minedTotal += rate;
        if (onBoost) state.chargeLeft = Math.max(0, state.chargeLeft - 1);

        state.lastTs = nowSec();
        saveState();
        render();
        ensureSpinState();
    }, 1000);
}

function ensureSpinState() {
    const onBoost = state.chargeLeft > 0;
    const rate = effectiveRate(onBoost);
    const secPerTurn = mapRateToSpin(rate);
    el.fan.style.animationDuration = `${secPerTurn}s`;
    el.fan.style.animationPlayState = rate > 0 ? "running" : "paused";

    // Прогрес бар
    const percent = Math.max(0, Math.min(100, (state.chargeLeft / CHARGE_DURATION) * 100));
    if (el.chargeBar) el.chargeBar.style.width = `${percent}%`;
}

function mapRateToSpin(rate) {
    const k = Math.max(1e-9, rate / BASE_RATE);
    const t = clamp(Math.log10(k) / Math.log10(BOOST_FACTOR * 10), 0, 1);
    return lerp(MAX_SPIN_SEC, MIN_SPIN_SEC, t);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function chargeMiner() {
    if (state.balance < CHARGE_COST) return toast("Недостаточно SC для зарядки.");
    state.balance -= CHARGE_COST;
    state.chargeLeft += CHARGE_DURATION;
    state.lastTs = nowSec();
    saveState();
    render();
    ensureSpinState();
    toast(`Заряжено на ${CHARGE_DURATION / 60} хв. 🚀`);
}

function upgradeMiner() {
    const price = currentUpgradeCost();
    if (state.balance < price) return toast("Недостаточно SC для апгрейду.");
    state.balance -= price;
    state.upgradeLevel += 1;
    saveState();
    render();
    ensureSpinState();
    toast(`Скорость добавленна! Уровень: x${state.upgradeLevel}`);
}

function currentUpgradeCost() {
    return UPGRADE_BASE_COST * Math.pow(UPGRADE_COST_MULT, state.upgradeLevel - 1);
}

function render() {
    const onBoost = state.chargeLeft > 0;
    const rate = effectiveRate(onBoost);
    el.speed.textContent = formatNum(rate);
    el.mined.textContent = formatNum(state.minedTotal, 9);
    el.balance.textContent = formatNum(state.balance, 9);
    el.boost.textContent = onBoost ? `x${BOOST_FACTOR}` : "x1";

    el.chargeBtn.disabled = state.balance < CHARGE_COST;
    if (el.upgradeBtn) {
        const price = currentUpgradeCost();
        el.upgradeBtn.disabled = state.balance < price;
        el.upgradeBtn.textContent = `⚡ Ускорить (${formatNum(price, 2)} SC)`;
    }
}

function attachHandlers() {
    el.chargeBtn?.addEventListener("click", chargeMiner);
    if (el.upgradeBtn) el.upgradeBtn.addEventListener("click", upgradeMiner);
}

function loadState() {
    const s = JSON.parse(localStorage.getItem("sc_powermine") || "{}");
    return {
        balance: typeof s.balance === "number" ? s.balance : 0,
        minedTotal: typeof s.minedTotal === "number" ? s.minedTotal : 0,
        chargeLeft: typeof s.chargeLeft === "number" ? s.chargeLeft : 0,
        upgradeLevel: Number.isInteger(s.upgradeLevel) ? Math.max(1, s.upgradeLevel) : 1,
        lastTs: typeof s.lastTs === "number" ? s.lastTs : 0
    };
}

function saveState() {
    localStorage.setItem("sc_powermine", JSON.stringify(state));
}

function nowSec() { return Math.floor(Date.now() / 1000); }
function formatNum(n, digits = 6) { return Number(n).toFixed(digits); }

function toast(msg) {
    console.log("[PowerMine]", msg);
}

// ---- Початкові стилі для анімації кулера ----
if (el.fan) {
    el.fan.style.transformOrigin = "50% 50%";
    el.fan.style.animationName = "spin";
    el.fan.style.animationTimingFunction = "linear";
    el.fan.style.animationIterationCount = "infinite";
    el.fan.style.animationDuration = `${MAX_SPIN_SEC}s`;
}

// ---- API для відладки ----
window.PowerMine = {
    get state() { return state; },
    chargeMiner,
    upgradeMiner,
    reset() { localStorage.removeItem("sc_powermine"); state = loadState(); render(); ensureSpinState(); }
};
