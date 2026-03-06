// --- STAN GRY ---
let wordsDatabase = [];
let gameRoles = []; 
let currentPlayerIndex = 0;
let currentWordData = null;

// --- ELEMENTY DOM ---
const screens = {
    menu: document.getElementById('menu-screen'),
    game: document.getElementById('game-screen')
};

// Menu
const playersCountSlider = document.getElementById('playersCount');
const impostorsCountSlider = document.getElementById('impostorsCount');
const playersValText = document.getElementById('playersVal');
const impostorsValText = document.getElementById('impostorsVal');
const hintsToggle = document.getElementById('hintsToggle');
const startBtn = document.getElementById('startBtn');
const menuError = document.getElementById('menu-error');

// Game Elements
const playerTurnText = document.getElementById('player-turn-text');
const card = document.getElementById('playerCard');
const revealBtn = document.getElementById('revealBtn');
const nextBtn = document.getElementById('nextBtn');
const cardBackInfo = document.getElementById('cardBackInfo');

// Ikony
const svgCrewmate = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.5 7.5C17.5 4.5 15 2 12 2C9 2 6.5 4.5 6.5 7.5V19C6.5 20.7 7.8 22 9.5 22H14.5C16.2 22 17.5 20.7 17.5 19V7.5Z"/><path d="M16 6H8C6.9 6 6 6.9 6 8V12C6 13.1 6.9 14 8 14H16C17.1 14 18 13.1 18 12V8C18 6.9 17.1 6 16 6Z" fill="#151824"/></svg>`;
const svgImpostor = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.5 7.5C17.5 4.5 15 2 12 2C9 2 6.5 4.5 6.5 7.5V19C6.5 20.7 7.8 22 9.5 22H14.5C16.2 22 17.5 20.7 17.5 19V7.5Z"/><path d="M8 8L16 12L8 16V8Z" fill="#151824"/></svg>`;

// --- INICJALIZACJA ---
document.addEventListener('DOMContentLoaded', () => {
    loadWords();

    // Suwaki i blokady liczby impostorów
    playersCountSlider.addEventListener('input', (e) => {
        playersValText.innerText = e.target.value;
        const maxImpostors = Math.max(1, Math.floor(e.target.value / 2));
        impostorsCountSlider.max = maxImpostors;
        if(impostorsCountSlider.value > maxImpostors) {
            impostorsCountSlider.value = maxImpostors;
            impostorsValText.innerText = maxImpostors;
        }
    });

    impostorsCountSlider.addEventListener('input', (e) => {
        impostorsValText.innerText = e.target.value;
    });

    startBtn.addEventListener('click', startGame);
    revealBtn.addEventListener('click', revealRole);
    nextBtn.addEventListener('click', handleNext);
});

// --- POBIERANIE DANYCH ---
async function loadWords() {
    try {
        const response = await fetch('hasla.txt');
        if (!response.ok) throw new Error("Brak pliku");
        const text = await response.text();
        parseWords(text);
    } catch (error) {
        console.warn('Wczytuję zapasową bazę.');
        // Zapasowa baza (pojedyncze słowa wg nowego formatu)
        parseWords("kosmos,ciemność,gwiazdy,próżnia;\npizza,ser,ciasto,sos;\nkomputer,monitor,klawiatura,myszka;\nsamochód,koła,silnik,kierownica;");
    }
}

function parseWords(text) {
    wordsDatabase = [];
    const lines = text.split(';');
    lines.forEach(line => {
        if (!line.trim()) return;
        const parts = line.split(',');
        if (parts.length >= 2) {
            const word = parts[0].trim();
            // Reszta części to podpowiedzi
            const hints = parts.slice(1).map(h => h.trim()).filter(h => h !== "");
            wordsDatabase.push({ word: word, hints: hints });
        }
    });
}

// --- LOGIKA GRY ---
function startGame() {
    const selectedPlayers = parseInt(playersCountSlider.value);
    const selectedImpostors = parseInt(impostorsCountSlider.value);

    if (selectedImpostors >= selectedPlayers) {
        menuError.innerText = "Liczba impostorów musi być mniejsza niż graczy!";
        return;
    }
    if (wordsDatabase.length === 0) {
        menuError.innerText = "Brak bazy haseł!";
        return;
    }

    menuError.innerText = "";
    
    // 1. Losuj zestaw (hasło + podpowiedzi)
    currentWordData = wordsDatabase[Math.floor(Math.random() * wordsDatabase.length)];

    // 2. Tasuj dostępne podpowiedzi dla impostorów
    let availableHints = [...currentWordData.hints];
    shuffleArray(availableHints);

    // 3. Buduj tablicę ról
    gameRoles = [];
    
    // Dodawanie impostorów z unikalnymi podpowiedziami
    for (let i = 0; i < selectedImpostors; i++) {
        let assignedHint = availableHints[i] || availableHints[0] || "brak";
        gameRoles.push({ role: 'impostor', hint: assignedHint });
    }
    
    // Dodawanie załogi (crewmates)
    for (let i = 0; i < (selectedPlayers - selectedImpostors); i++) {
        gameRoles.push({ role: 'crewmate', hint: null });
    }

    // Tasowanie kolejności wszystkich graczy
    shuffleArray(gameRoles);

    // Resetuj UI
    currentPlayerIndex = 0;
    switchScreen('game');
    preparePlayerTurn();
}

function preparePlayerTurn() {
    // USUNIĘCIE BŁĘDU MIGNIĘCIA KARTY
    // 1. Wyłączamy animację przejścia (transition)
    card.style.transition = 'none';
    // 2. Natychmiast obracamy kartę "twarzą w dół"
    card.classList.remove('is-flipped');
    // 3. Wymuszamy na przeglądarce natychmiastowe zastosowanie zmian (tzw. reflow)
    void card.offsetHeight;
    // 4. Przywracamy animację dla późniejszego kliknięcia "SHOW"
    card.style.transition = '';

    nextBtn.classList.add('hidden');
    playerTurnText.innerText = `Gracz ${currentPlayerIndex + 1}`;
    
    const playerData = gameRoles[currentPlayerIndex];
    const isHintsOn = hintsToggle.checked;

    if (playerData.role === 'impostor') {
        cardBackInfo.className = 'card-face card-back impostor';
        let hintHtml = isHintsOn 
            ? `<div class="info-box"><div class="info-label">Podpowiedź</div><div class="info-value">${playerData.hint}</div></div>` 
            : `<div class="info-box"><div class="info-label">Podpowiedź</div><div class="info-value" style="color:#666;">WYŁĄCZONA</div></div>`;

        cardBackInfo.innerHTML = `
            <div class="role-icon">${svgImpostor}</div>
            <div class="role-title">You are the Impostor</div>
            ${hintHtml}
        `;
    } else {
        cardBackInfo.className = 'card-face card-back crewmate';
        cardBackInfo.innerHTML = `
            <div class="role-icon">${svgCrewmate}</div>
            <div class="role-title">You are a Crewmate</div>
            <div class="info-box">
                <div class="info-label">Sekretne Hasło</div>
                <div class="info-value">${currentWordData.word}</div>
            </div>
        `;
    }
}

function revealRole() {
    card.classList.add('is-flipped');
    
    if (currentPlayerIndex === gameRoles.length - 1) {
        nextBtn.innerText = "BACK TO MENU";
        nextBtn.className = "neon-btn glow-red";
    } else {
        nextBtn.innerText = "NEXT PLAYER";
        nextBtn.className = "neon-btn glow-blue";
    }
    
    setTimeout(() => { nextBtn.classList.remove('hidden'); }, 400);
}

function handleNext() {
    currentPlayerIndex++;
    if (currentPlayerIndex < gameRoles.length) {
        preparePlayerTurn();
    } else {
        switchScreen('menu');
        nextBtn.innerText = "NEXT PLAYER"; 
    }
}

// Algorytm Fisher-Yates
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function switchScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}