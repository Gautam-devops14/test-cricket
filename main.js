// main.js - FINAL UPDATED VERSION

let currentMatchId = null;
let allPlayersList = []; 

let gameState = {
    inning: 1, 
    battingTeam: 1, 
    team1Name: "Team A",
    team2Name: "Team B",
    config: { groupName: "Default", wicketLimit: 10, twoBatterMode: false },
    currentPlayers: { batsman: "", nonStriker: "", bowler: "" },
    bowlerHistory: [], 
    inningsStats: { 
        1: { batting: {}, bowling: {}, extras: { wd:0, nb:0, b:0, lb:0, total:0 } }, 
        2: { batting: {}, bowling: {}, extras: { wd:0, nb:0, b:0, lb:0, total:0 } }, 
        3: { batting: {}, bowling: {}, extras: { wd:0, nb:0, b:0, lb:0, total:0 } }, 
        4: { batting: {}, bowling: {}, extras: { wd:0, nb:0, b:0, lb:0, total:0 } } 
    },
    scores: {
        1: { runs: 0, wickets: 0, overs: 0, balls: 0, runsThisOver: 0, thisOver: [], oversHistory: [] }, 
        2: { runs: 0, wickets: 0, overs: 0, balls: 0, runsThisOver: 0, thisOver: [], oversHistory: [] },
        3: { runs: 0, wickets: 0, overs: 0, balls: 0, runsThisOver: 0, thisOver: [], oversHistory: [] },
        4: { runs: 0, wickets: 0, overs: 0, balls: 0, runsThisOver: 0, thisOver: [], oversHistory: [] }
    }
};

function ensureStatsIntegrity(state) {
    if (!state) return gameState; 
    if (!state.config) state.config = { groupName: "Default", wicketLimit: 10, twoBatterMode: false };
    if (!state.currentPlayers) state.currentPlayers = { batsman: "", nonStriker: "", bowler: "" };
    if (!state.bowlerHistory) state.bowlerHistory = [];
    if (!state.inningsStats) state.inningsStats = {};
    if (!state.scores) state.scores = {};
    for (let i = 1; i <= 4; i++) {
        if (!state.scores[i]) state.scores[i] = { runs: 0, wickets: 0, overs: 0, balls: 0, runsThisOver: 0, thisOver: [], oversHistory: [] };
        if (!state.scores[i].thisOver) state.scores[i].thisOver = [];
        if (!state.scores[i].oversHistory) state.scores[i].oversHistory = [];
        if (!state.inningsStats[i]) state.inningsStats[i] = {};
        if (!state.inningsStats[i].batting) state.inningsStats[i].batting = {};
        if (!state.inningsStats[i].bowling) state.inningsStats[i].bowling = {};
        if (!state.inningsStats[i].extras) state.inningsStats[i].extras = { wd:0, nb:0, b:0, lb:0, total:0 };
    }
    return state;
}

window.onload = function() { 
    loadMatchList(); 
    loadPlayerRegistry(); 
};

// --- PLAYER DATABASE FUNCTIONS ---
function loadPlayerRegistry() {
    database.ref('players').on('value', (snapshot) => {
        allPlayersList = [];
        const players = snapshot.val();
        if (players) {
            Object.keys(players).forEach(key => allPlayersList.push(key));
        }
        updatePlayerDropdowns();
    });
}

function addNewPlayerToDB() {
    // Get values from the HTML inputs
    const nameInput = document.getElementById("new-player-name");
    const roleInput = document.getElementById("new-player-role");
    
    const name = nameInput.value.trim();
    const role = roleInput.value;

    if (!name) { alert("Enter a name!"); return; }
    if (allPlayersList.includes(name)) { alert("Player already exists!"); return; }

    database.ref('players/' + name).set({
        role: role,
        matches: 0, 
        runs: 0, 
        wickets: 0
    });
    
    alert(`${name} (${role}) added to database!`);
    nameInput.value = ""; // Clear input
}

function updatePlayerDropdowns() {
    let opts = '';
    allPlayersList.sort().forEach(p => { opts += `<option value="${p}">`; });
    
    let datalist = document.getElementById("saved-players-list");
    if (!datalist) {
        datalist = document.createElement("datalist");
        datalist.id = "saved-players-list";
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = opts;
    
    // Attach to all relevant inputs
    const inputs = ["batsman-name", "non-striker-name", "bowler-name", "new-batsman-input", "next-bowler-input"];
    inputs.forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).setAttribute("list", "saved-players-list");
    });
}

// --- BASIC UI HELPERS ---
function showCustomAlert(msg, title="Notice") {
    const el = document.getElementById("custom-alert-modal");
    if(el) {
        document.getElementById("alert-title").innerText = title;
        document.getElementById("alert-message").innerText = msg;
        el.style.display = 'flex';
    } else {
        alert(title + ": " + msg);
    }
}
function closeCustomAlert() { document.getElementById("custom-alert-modal").style.display = 'none'; }

function showCustomConfirm(msg, yesCallback) {
    document.getElementById("confirm-message").innerText = msg;
    const yesBtn = document.getElementById("confirm-yes-btn");
    const newBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newBtn, yesBtn);
    newBtn.addEventListener('click', function() { yesCallback(); closeCustomConfirm(); });
    document.getElementById("custom-confirm-modal").style.display = 'flex';
}
function closeCustomConfirm() { document.getElementById("custom-confirm-modal").style.display = 'none'; }

// --- MATCH MANAGEMENT ---
function validateBeforeBall() {
    const p = gameState.currentPlayers;
    if (!p.bowler || p.bowler.trim() === "") { showCustomAlert("Please enter a Bowler name first!", "Missing Player"); return false; }
    if (!p.batsman || p.batsman.trim() === "") { showCustomAlert("Please enter the Striker's name!", "Missing Player"); return false; }
    if (gameState.config.twoBatterMode) {
        if (!p.nonStriker || p.nonStriker.trim() === "") { showCustomAlert("Please enter the Non-Striker's name!", "Missing Player"); return false; }
    }
    return true;
}

function showStartScreen() {
    document.getElementById("start-screen").classList.remove("hidden");
    document.getElementById("setup-area").classList.add("hidden");
    document.getElementById("scoreboard").classList.add("hidden");
    document.getElementById("next-bowler-modal").style.display = 'none';
    document.getElementById("new-batsman-modal").style.display = 'none';
    if (currentMatchId) database.ref('matches/' + currentMatchId).off('value'); 
    currentMatchId = null;
    loadMatchList(); 
}

function showNewMatchSetup() {
    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("setup-area").classList.remove("hidden");
}

function loadMatchList() {
    const list = document.getElementById("match-list");
    list.innerHTML = '<p style="text-align:center; color:#777;">Loading matches...</p>';
    
    database.ref('matches').on('value', (snapshot) => {
        list.innerHTML = ''; 
        const matches = snapshot.val();
        
        if (!matches) { 
            list.innerHTML = '<p style="text-align:center; color:#777;">No matches found. Start a new one!</p>'; 
            return; 
        }

        Object.keys(matches).forEach(key => {
            const m = matches[key];
            
            // Container
            const container = document.createElement('div');
            container.className = 'match-item-container';
            
            // Select Button
            const btn = document.createElement('button');
            btn.className = 'match-select-btn';
            btn.innerHTML = `<strong>${m.team1Name || 'Team A'}</strong> vs <strong>${m.team2Name || 'Team B'}</strong> <br><small style="color:#666">Inning ${m.inning || 1}</small>`;
            btn.onclick = () => continueMatch(key);
            
            // Delete Button
            const delBtn = document.createElement('button');
            delBtn.className = 'match-delete-btn';
            delBtn.innerText = "DELETE"; 
            delBtn.onclick = (e) => { 
                e.stopPropagation(); 
                showCustomConfirm("Delete this match permanently?", () => deleteMatchFromHistory(key));
            };

            container.appendChild(btn);
            container.appendChild(delBtn);
            list.appendChild(container);
        });
    });
}

function deleteMatchFromHistory(matchId) { database.ref('matches/' + matchId).remove(); }

function continueMatch(matchId) {
    currentMatchId = matchId;
    database.ref('matches/' + currentMatchId).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            gameState = ensureStatsIntegrity(data);
            document.getElementById("start-screen").classList.add("hidden");
            document.getElementById("setup-area").classList.add("hidden");
            document.getElementById("scoreboard").classList.remove("hidden");
            document.getElementById("batsman-name").value = gameState.currentPlayers.batsman || "";
            document.getElementById("non-striker-name").value = gameState.currentPlayers.nonStriker || "";
            document.getElementById("bowler-name").value = gameState.currentPlayers.bowler || "";
            document.getElementById("two-batter-mode").checked = gameState.config.twoBatterMode || false;
            toggleBatterMode(); 
            updateDisplay(); 
        }
    });
}

function startGame() {
    let t1 = document.getElementById("team1-name").value || "Team A";
    let t2 = document.getElementById("team2-name").value || "Team B";
    let grp = document.getElementById("group-name").value || "Default";
    let wLim = parseInt(document.getElementById("wicket-limit").value) || 10;
    
    let newState = {
        inning: 1, battingTeam: 1, team1Name: t1, team2Name: t2,
        config: { groupName: grp, wicketLimit: wLim, twoBatterMode: false },
        currentPlayers: { batsman: "", nonStriker: "", bowler: "" },
        bowlerHistory: [],
        inningsStats: {}, scores: {}        
    };
    gameState = ensureStatsIntegrity(newState);
    
    const newRef = database.ref('matches').push();
    currentMatchId = newRef.key;
    saveGame(); 
    
    document.getElementById("setup-area").classList.add("hidden");
    document.getElementById("scoreboard").classList.remove("hidden");
    updateDisplay();
}

function toggleBatterMode() {
    let isTwo = document.getElementById("two-batter-mode").checked;
    if(!gameState.config) gameState.config = {};
    gameState.config.twoBatterMode = isTwo;
    document.getElementById("non-striker-name").style.display = isTwo ? "block" : "none";
    document.getElementById("swap-container").style.display = isTwo ? "block" : "none";
    saveGame();
}

function updatePlayerNames() {
    let b = document.getElementById("batsman-name").value.trim();
    let ns = document.getElementById("non-striker-name").value.trim();
    let bo = document.getElementById("bowler-name").value.trim();
    
    gameState.currentPlayers = { batsman: b, nonStriker: ns, bowler: bo };
    let inn = gameState.inning;
    gameState = ensureStatsIntegrity(gameState); 
    let stats = gameState.inningsStats[inn];
    
    if (b && !stats.batting[b]) stats.batting[b] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
    if (ns && !stats.batting[ns]) stats.batting[ns] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
    if(bo && !gameState.bowlerHistory.includes(bo)) gameState.bowlerHistory.push(bo);
    
    saveGame();
    showToast("Players Set");
}

function swapStrikers(manual) {
    if (!gameState.config.twoBatterMode) return;
    let temp = gameState.currentPlayers.batsman;
    gameState.currentPlayers.batsman = gameState.currentPlayers.nonStriker;
    gameState.currentPlayers.nonStriker = temp;
    document.getElementById("batsman-name").value = gameState.currentPlayers.batsman;
    document.getElementById("non-striker-name").value = gameState.currentPlayers.nonStriker;
    if(manual) { saveGame(); showToast("Ends Swapped"); }
}

// --- SCORING LOGIC ---
function addRuns(runs, type) {
    if (!validateBeforeBall()) return;
    if (gameState.inning > 4) return;
    
    gameState = ensureStatsIntegrity(gameState);
    let inn = gameState.inning;
    let stats = gameState.inningsStats[inn];
    let currentScore = gameState.scores[inn];
    let bName = gameState.currentPlayers.batsman;
    let boName = gameState.currentPlayers.bowler;

    let isLegal = true;
    let runsForTotal = runs;
    let runsForBatsman = runs;
    let runsForBowler = runs;
    let extraRuns = 0;

    if (type === 'wd') {
        isLegal = false;
        extraRuns = 1 + runs; 
        runsForTotal = extraRuns;
        runsForBatsman = 0; 
        runsForBowler = extraRuns; 
        stats.extras.wd += extraRuns;
        stats.extras.total += extraRuns;
    } 
    else if (type === 'nb') {
        isLegal = false;
        extraRuns = 1; 
        runsForTotal = 1 + runs; 
        runsForBatsman = runs; 
        runsForBowler = runsForTotal;
        stats.extras.nb += 1;
        stats.extras.total += 1;
    } 

    if (bName) {
        if (!stats.batting[bName]) stats.batting[bName] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
        let p = stats.batting[bName];
        p.runs += runsForBatsman;
        if (type !== 'wd') p.balls += 1; 
        if (isLegal) {
            if (runs === 4) p.fours += 1;
            if (runs === 6) p.sixes += 1;
        }
    }
    if (boName) {
        if (!stats.bowling[boName]) stats.bowling[boName] = { runs: 0, balls: 0, wickets: 0 };
        let bo = stats.bowling[boName];
        bo.runs += runsForBowler; 
        if (isLegal) bo.balls += 1;
    }

    currentScore.runs += runsForTotal;
    currentScore.runsThisOver += runsForTotal;

    let ballLabel = runs.toString();
    if(type === 'wd') ballLabel = (runs > 0) ? (1+runs)+"wd" : "wd";
    else if(type === 'nb') ballLabel = (runs > 0) ? runs+"nb" : "nb";
    currentScore.thisOver.push(ballLabel);

    if (isLegal) {
        currentScore.balls++;
        if (gameState.config.twoBatterMode && (runs % 2 !== 0)) swapStrikers(false);
    } else {
        if (gameState.config.twoBatterMode && (runs % 2 !== 0)) swapStrikers(false);
    }

    if (currentScore.balls === 6) { handleOverEnd(currentScore); return; }
    
    saveGame();
}

function handleOverEnd(currentScore) {
    currentScore.overs++;
    currentScore.balls = 0; 
    currentScore.oversHistory.push({ over: currentScore.overs, runs: currentScore.runsThisOver });
    currentScore.runsThisOver = 0;
    currentScore.thisOver = []; 
    if (gameState.config.twoBatterMode) swapStrikers(false);
    saveGame();
    showNextBowlerModal();
}

function addWicket() {
    if (!validateBeforeBall()) return; 
    gameState = ensureStatsIntegrity(gameState);
    let inn = gameState.inning;
    let stats = gameState.inningsStats[inn];
    let currentScore = gameState.scores[inn];
    let limit = gameState.config.wicketLimit || 10;
    let bName = gameState.currentPlayers.batsman;
    let boName = gameState.currentPlayers.bowler;

    if (boName) {
        if (!stats.bowling[boName]) stats.bowling[boName] = { runs: 0, balls: 0, wickets: 0 };
        stats.bowling[boName].wickets += 1;
        stats.bowling[boName].balls += 1; 
    }
    if (bName) {
        if (!stats.batting[bName]) stats.batting[bName] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
        stats.batting[bName].out = "Out";
        gameState.currentPlayers.batsman = ""; 
        document.getElementById("batsman-name").value = "";
    }

    if (currentScore.wickets < limit) currentScore.wickets++;
    currentScore.thisOver.push("W");
    currentScore.balls++; 

    if (currentScore.wickets >= limit) {
        showCustomAlert("All Out! Inning Ended.", "Inning Over");
        setTimeout(triggerDeclare, 1500);
    } else {
        if(currentScore.balls >= 6) {
            handleOverEnd(currentScore);
            setTimeout(showNewBatsmanModal, 500); 
        } else {
            saveGame();
            showNewBatsmanModal();
        }
    }
}

// --- MODALS & DECLARE ---
function showNewBatsmanModal() {
    document.getElementById("new-batsman-modal").style.display = 'flex';
    document.getElementById("new-batsman-input").value = "";
    document.getElementById("new-batsman-input").focus();
}

function confirmNewBatsman() {
    let newName = document.getElementById("new-batsman-input").value.trim();
    if (!newName) { showCustomAlert("Name required!"); return; }
    gameState.currentPlayers.batsman = newName;
    document.getElementById("batsman-name").value = newName;
    
    let inn = gameState.inning;
    if(!gameState.inningsStats[inn].batting[newName]) {
        gameState.inningsStats[inn].batting[newName] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
    }
    document.getElementById("new-batsman-modal").style.display = 'none';
    
    let currentScore = gameState.scores[gameState.inning];
    if (currentScore.balls === 6) handleOverEnd(currentScore);
    else saveGame();
}

function showNextBowlerModal() {
    document.getElementById("next-bowler-modal").style.display = 'flex';
    document.getElementById("next-bowler-input").value = "";
    document.getElementById("next-bowler-input").focus();
}

function confirmNextBowler() {
    let newBowler = document.getElementById("next-bowler-input").value.trim();
    if (!newBowler) { showCustomAlert("Bowler name required!"); return; }
    
    gameState.currentPlayers.bowler = newBowler;
    document.getElementById("bowler-name").value = newBowler;
    let currentScore = gameState.scores[gameState.inning];
    currentScore.thisOver = []; 
    if(!gameState.bowlerHistory.includes(newBowler)) gameState.bowlerHistory.push(newBowler);
    document.getElementById("next-bowler-modal").style.display = 'none';
    saveGame();
    showToast("New Over Started");
}

function showToast(msg, duration = 1500) {
    const t = document.getElementById("toast");
    if(t) {
        t.innerText = msg;
        t.classList.remove("hidden");
        t.style.display = "block";
        setTimeout(() => { t.style.display = "none"; }, duration);
    }
}

function triggerDeclare() { showCustomConfirm("End Inning? (Switch Teams)", declareInningLogic); }

function declareInningLogic() {
    gameState.inning++;
    if(gameState.inning === 2 || gameState.inning === 4) { gameState.battingTeam = 2; } 
    else { gameState.battingTeam = 1; }
    
    gameState.currentPlayers = { batsman: "", nonStriker: "", bowler: "" };
    document.getElementById("batsman-name").value = "";
    document.getElementById("non-striker-name").value = "";
    document.getElementById("bowler-name").value = "";

    saveGame();
    updateDisplay();
    showToast("Inning Declared");
}

function saveGame() {
    if (currentMatchId) database.ref('matches/' + currentMatchId).set(gameState);
    updateDisplay(); 
}

// --- DISPLAY RENDERER ---
function updateDisplay() {
    if (!gameState) return; 
    
    renderFullHistory();
    updateSituation();
    
    if(gameState.inning > 4) { 
        document.getElementById("match-status").innerText = "Match Completed"; 
        return; 
    }
    
    let inn = gameState.inning;
    if (!gameState.scores[inn]) gameState.scores[inn] = { runs: 0, wickets: 0, overs: 0, balls: 0 };
    if (!gameState.inningsStats[inn]) gameState.inningsStats[inn] = { batting: {}, bowling: {}, extras: { total:0, wd:0, nb:0 } };

    let score = gameState.scores[inn];
    let stats = gameState.inningsStats[inn];
    let teamName = (gameState.battingTeam === 1) ? gameState.team1Name : gameState.team2Name;

    document.getElementById("match-status").innerText = `Inning ${inn}`;
    document.getElementById("batting-team-label").innerText = teamName + " Batting";
    document.getElementById("score").innerText = score.runs;
    document.getElementById("wickets").innerText = score.wickets;
    
    // OVERS & CRR
    document.getElementById("overs").innerText = `${score.overs}.${score.balls}`;
    let totalLegalBalls = (score.overs * 6) + score.balls;
    let crr = totalLegalBalls > 0 ? (score.runs / (totalLegalBalls/6)).toFixed(2) : "0.0";
    if(document.getElementById("crr-display")) document.getElementById("crr-display").innerText = crr;
    
    // EXTRAS
    let ext = stats.extras || { total:0 };
    if(document.getElementById("extras-display")) document.getElementById("extras-display").innerText = `Extras: ${ext.total} (wd ${ext.wd}, nb ${ext.nb})`;

    // BUBBLES
    const thisOverDiv = document.getElementById("this-over-balls");
    if(thisOverDiv) {
        thisOverDiv.innerHTML = "";
        if(score.thisOver) {
            score.thisOver.forEach(ball => {
                let className = "ball-bubble";
                if(ball.includes("4")) className += " ball-4";
                if(ball.includes("6")) className += " ball-6";
                if(ball.includes("W") && !ball.includes("wd")) className += " ball-w";
                thisOverDiv.innerHTML += `<div class="${className}">${ball}</div>`;
            });
        }
    }

    const batBody = document.getElementById("batting-tbody"); 
    if(batBody) {
        batBody.innerHTML = "";
        if (stats.batting) {
            Object.keys(stats.batting).forEach(name => {
                let p = stats.batting[name];
                let sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(0) : 0;
                let isStriker = (name === gameState.currentPlayers.batsman);
                let isNonStriker = (name === gameState.currentPlayers.nonStriker);
                if (!gameState.config.twoBatterMode) isNonStriker = false;
                let status = p.out ? "(out)" : (isStriker ? "*" : (isNonStriker ? "^" : ""));
                let rowStyle = (isStriker || isNonStriker) ? "background:#e8f5e9; font-weight:bold;" : "";
                if (p.out) rowStyle = "background:#ffebee; color:#d32f2f;";
                batBody.innerHTML += `<tr style="${rowStyle}"><td>${name} ${!p.out ? status : ''}</td><td><strong>${p.runs}</strong></td><td>${p.balls}</td><td>${p.fours}</td><td>${p.sixes}</td><td>${sr}</td></tr>`;
            });
        }
    }

    const bowlBody = document.getElementById("bowling-tbody"); 
    if(bowlBody) {
        bowlBody.innerHTML = "";
        if (stats.bowling) {
            Object.keys(stats.bowling).forEach(name => {
                let b = stats.bowling[name];
                let eco = (b.balls > 0) ? (b.runs / (b.balls/6)).toFixed(1) : "-";
                let isCurrent = (name === gameState.currentPlayers.bowler);
                let rowStyle = isCurrent ? "background:#e0ffe0; border-left: 3px solid #004d40;" : "";
                bowlBody.innerHTML += `<tr style="${rowStyle}"><td>${name}</td><td>${Math.floor(b.balls/6)}.${b.balls%6}</td><td>${b.runs}</td><td>${b.wickets}</td><td>${eco}</td></tr>`;
            });
        }
    }
}

function updateSituation() {
    let A1 = gameState.scores[1] ? gameState.scores[1].runs : 0;
    let B1 = gameState.scores[2] ? gameState.scores[2].runs : 0;
    let A2 = gameState.scores[3] ? gameState.scores[3].runs : 0;
    let B2 = gameState.scores[4] ? gameState.scores[4].runs : 0;
    
    let msg = "";
    if(gameState.inning === 1) msg = "1st Inning in Progress";
    else if(gameState.inning === 2) {
        let diff = A1 - B1;
        if(diff > 0) msg = `${gameState.team2Name} trails by ${diff}`;
        else msg = `${gameState.team2Name} leads by ${Math.abs(diff)}`;
    }
    else if(gameState.inning === 3) {
        let lead = (A1 + A2) - B1;
        msg = `${gameState.team1Name} Overall Lead: ${lead}`;
    }
    else if(gameState.inning === 4) {
        let target = (A1 + A2) - B1 + 1;
        let need = target - B2;
        if(need > 0) msg = `Target: ${target} | Needs ${need} runs`;
        else msg = `${gameState.team2Name} Won!`;
    }
    if(document.getElementById("situation-display")) document.getElementById("situation-display").innerText = msg;
}

function renderFullHistory() {
    const container = document.getElementById("history-container");
    if(!container) return;
    container.innerHTML = "";
    
    for(let i=1; i<=4; i++) {
        if(!gameState.scores[i]) continue;
        if(i > gameState.inning) continue;

        let stats = gameState.inningsStats[i] || { batting: {}, bowling: {} };
        let teamName = (i === 1 || i === 3) ? gameState.team1Name : gameState.team2Name;
        let innLabel = (i === 1 || i === 2) ? "1st Inn" : "2nd Inn";
        
        let html = `
            <div style="margin-bottom:20px; border:1px solid #ddd; padding:5px; background:#fafafa;">
                <h4 style="background:#eee; padding:8px; margin:0; border-bottom:1px solid #ddd;">
                    ${teamName} (${innLabel})
                    <span style="float:right; font-weight:bold;">${gameState.scores[i].runs}/${gameState.scores[i].wickets} (${gameState.scores[i].overs}.${gameState.scores[i].balls})</span>
                </h4>
                <h5 style="margin:5px 0; color:#004d40; padding-left:5px;">Batting</h5>
                <table class="score-table"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>
        `;
        
        if(stats.batting) {
            Object.keys(stats.batting).forEach(name => {
                let p = stats.batting[name];
                let sr = p.balls > 0 ? ((p.runs / p.balls) * 100).toFixed(1) : "0.0";
                let outStr = p.out ? "(out)" : "";
                html += `<tr><td>${name} <small style="color:red">${outStr}</small></td><td>${p.runs}</td><td>${p.balls}</td><td>${p.fours}</td><td>${p.sixes}</td><td>${sr}</td></tr>`;
            });
        }
        
        html += `</tbody></table>
            <h5 style="margin:5px 0; color:#004d40; padding-left:5px;">Bowling</h5>
            <table class="score-table"><thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>ECO</th></tr></thead><tbody>
        `;
        
        if(stats.bowling) {
            Object.keys(stats.bowling).forEach(name => {
                let b = stats.bowling[name];
                let eco = b.balls > 0 ? (b.runs / (b.balls / 6)).toFixed(1) : "0.0";
                html += `<tr><td>${name}</td><td>${Math.floor(b.balls/6)}.${b.balls%6}</td><td>${b.runs}</td><td>${b.wickets}</td><td>${eco}</td></tr>`;
            });
        }
        html += `</tbody></table></div>`;
        container.innerHTML += html;
    }
}
