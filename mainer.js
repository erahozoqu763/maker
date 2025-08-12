// =============== SafeChain PowerMine (Frontend-only) ===============
// Працює суто в браузері, все зберігається в localStorage.
// HTML очікує ids: speed, mined, balance, boost, charge, fanImg (та опц. upgrade).

// ---- Налаштування гри ----
const BASE_RATE = 1e-10;            // SC/сек без зарядки (повільне накопичення)
const BOOST_FACTOR = 100;            // множник швидкості під час зарядки
const CHARGE_COST = 50;              // SC за одну зарядку
const CHARGE_DURATION = 300;         // сек тривалості зарядки (5 хв)
const UPGRADE_BASE_COST = 200;       // базова ціна апгрейду (якщо використовуєш кнопку upgrade)
const UPGRADE_COST_MULT = 2;         // множник ціни апгрейду (200, 400, 800, ...)
const MIN_SPIN_SEC = 0.6;            // найшвидше обертання кулера (сек за оберт)
const MAX_SPIN_SEC = 12;             // найповільніше обертання кулера (сек за оберт)

// ---- Елементи DOM ----
const el = {
    speed: document.getElementById("speed"),
    mined: document.getElementById("mined"),
    balance: document.getElementById("balance"),
    boost: document.getElementById("boost"),
    chargeBtn: document.getElementById("charge"),
    upgradeBtn: document.getElementById("upgrade"), // може бути відсутня — ок
    fan: document.getElementById("fanImg")
};

// ---- Стан (localStorage) ----
let state = loadState();
let tickTimer = null;

// ---- Ініціалізація ----
resumeOfflineProgress();
render();
ensureSpinState();
attachHandlers();
startTicker();

// ================== ФУНКЦІЇ ==================

// Базова швидкість з урахуванням апгрейду
function baseRate() {
    return BASE_RATE * state.upgradeLevel;
}

// Ефективна швидкість (з бустом або без)
function effectiveRate(isBoost) {
    return baseRate() * (isBoost ? BOOST_FACTOR : 1);
}

// Відновлюємо прогрес за час, поки вкладка була закрита
function resumeOfflineProgress() {
    const now = nowSec();
    const last = state.lastTs || now;
    let elapsed = Math.max(0, Math.floor(now - last));
    if (!elapsed) return (state.lastTs = now, saveState());

    // Скільки секунд ще було бусту на момент виходу
    const boostLeft = Math.max(0, state.chargeLeft);
    const boostUsed = Math.min(boostLeft, elapsed);
    const idleUsed = elapsed - boostUsed;

    // Нарахувати SC з урахуванням бусту та без
    const minedBoost = effectiveRate(true) * boostUsed;
    const minedIdle = effectiveRate(false) * idleUsed;
    const minedTotal = minedBoost + minedIdle;

    state.balance += minedTotal;
    state.minedTotal += minedTotal;
    state.chargeLeft = Math.max(0, state.chargeLeft - elapsed);
    state.lastTs = now;
    saveState();
}

// Головний тікер (щосекунди)
function startTicker() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
        const now = nowSec();
        const elapsed = 1;
        state.lastTs = now;

        const onBoost = state.chargeLeft > 0;
        const rate = effectiveRate(onBoost);
        state.balance += rate * elapsed;
        state.minedTotal += rate * elapsed;
        if (onBoost) state.chargeLeft = Math.max(0, state.chargeLeft - elapsed);

        saveState();
        render();
        ensureSpinState();
    }, 1000);
}

// Старт/стоп обертання кулера та швидкість
function ensureSpinState() {
    const onBoost = state.chargeLeft > 0;
    const rate = effectiveRate(onBoost);

    // Мапимо швидкість → період оберту (сек/оберт)
    const secPerTurn = mapRateToSpin(rate);
    el.fan.style.animationDuration = `${secPerTurn}s`;
    el.fan.style.animationPlayState = rate > 0 ? "running" : "paused";
}

function mapRateToSpin(rate) {
    // Логарифмічне мапування, щоб візуально відчувалась різниця
    // При дуже малій швидкості — повільно (MAX_SPIN_SEC), при великій — швидко (MIN_SPIN_SEC).
    // Нормуємо відносно BASE_RATE.
    const k = Math.max(1e-12, rate / BASE_RATE);    // уникнути 0/поділу
    // log шкала
    const t = clamp(Math.log10(k) / Math.log10(BOOST_FACTOR * 10), 0, 1);
    // інтерполяція
    return lerp(MAX_SPIN_SEC, MIN_SPIN_SEC, t);
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// Зарядка майнера за SC
function chargeMiner() {
    if (state.balance < CHARGE_COST) {
        toast("Недостатньо SC для зарядки.");
        return;
    }
    state.balance -= CHARGE_COST;
    state.chargeLeft += CHARGE_DURATION;
    state.lastTs = nowSec();
    saveState();
    render();
    ensureSpinState();
    toast(`Заряджено на ${CHARGE_DURATION / 60} хв. 🚀`);
}

// Опційний апгрейд базової швидкості (перманентний)
function upgradeMiner() {
    const price = currentUpgradeCost();
    if (state.balance < price) {
        toast("Недостатньо SC для апгрейду.");
        return;
    }
    state.balance -= price;
    state.upgradeLevel += 1;
    saveState();
    render();
    ensureSpinState();
    toast(`Швидкість підвищено! Рівень: x${state.upgradeLevel}`);
}

// Рендер інтерфейсу
function render() {
    const onBoost = state.chargeLeft > 0;
    const rate = effectiveRate(onBoost);

    el.speed.textContent = formatNum(rate, 12);
    el.mined.textContent = formatNum(state.minedTotal, 9);
    el.balance.textContent = formatNum(state.balance, 9);
    el.boost.textContent = onBoost ? `x${BOOST_FACTOR}` : "x1";

    // Стан кнопок
    el.chargeBtn.disabled = state.balance < CHARGE_COST;
    if (el.upgradeBtn) {
        const price = currentUpgradeCost();
        el.upgradeBtn.disabled = state.balance < price;
        el.upgradeBtn.textContent = `⚡ Прискорити (ціна ${formatNum(price, 2)} SC)`;
    }
}

// Обробники кнопок
function attachHandlers() {
    el.chargeBtn?.addEventListener("click", chargeMiner);
    if (el.upgradeBtn) el.upgradeBtn.addEventListener("click", upgradeMiner);
}

// Сховище
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

// Утиліти
function nowSec() { return Math.floor(Date.now() / 1000); }
function formatNum(n, digits = 6) { return Number(n).toFixed(digits); }

let toastTimer = null;
function toast(msg) {
    // простий нон-блокінг «ало» через alert замінюємо на console+optional
    console.log(msg);
    // Якщо захочеш, можна додати DOM-тост. Зараз без DOM-елемента, щоб не лізти в HTML.
}

// Початкові стилі для спіну, якщо не задані в CSS
if (el.fan) {
    // щоб мати контроль з JS
    el.fan.style.transformOrigin = "50% 50%";
    el.fan.style.animationName = "spin";
    el.fan.style.animationTimingFunction = "linear";
    el.fan.style.animationIterationCount = "infinite";
    // базова тривалість — підлаштовуємо динамічно
    el.fan.style.animationDuration = `${MAX_SPIN_SEC}s`;
}

// ================================================================
// Якщо хочеш відображати зворотній відлік буста — додай елемент і виводь state.chargeLeft
// Також легко додати «квести» для отримання SC: просто збільшуй state.balance.
// ================================================================

// Опційно: експорт у window для дебага
window.PowerMine = {
    get state() { return state; },
    chargeMiner,
    upgradeMiner,
    reset() { localStorage.removeItem("sc_powermine"); state = loadState(); render(); ensureSpinState(); }
};
