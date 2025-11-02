<meta name='viewport' content='width=device-width, initial-scale=1'/><script>import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth, userId = null;
let hasArcanaKey = false;
let adventureCount = 0;
const UNLOCK_THRESHOLD = 100;

setLogLevel('Debug');

const reverb = new Tone.Reverb(1.5).toDestination();
const mainSynth = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.005, decay: 0.5, release: 0.2 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5, }).connect(reverb);
const choiceSynth = new Tone.PluckSynth({ attackNoise: 0.8, dampening: 4000, resonance: 0.9, release: 0.1 }).toDestination();
const successSynth = new Tone.MembraneSynth({ pitchDecay: 0.008, octave: 2, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.2 } }).toDestination();
const unlockSynth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 1 } }).toDestination();

const startClick = () => { Tone.context.resume().then(() => { mainSynth.triggerAttackRelease(["C4", "Eb4", "G4"], "0.6s", Tone.now(), 0.8); }); };
const choiceClick = () => { Tone.context.resume().then(() => { choiceSynth.triggerAttackRelease(["G5", "C6"], "8n"); }); };
const successSound = () => { Tone.context.resume().then(() => { successSynth.triggerAttackRelease("C4", "4n"); }); };
const unlockSound = () => { Tone.context.resume().then(() => { unlockSynth.triggerAttackRelease(["C5", "E5", "G5", "C6"], "1s"); }); };


const storyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 color-story"><path d="M15 11h.01"/><path d="M12 2v20"/><path d="M5 22h14"/><path d="M18 22V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v18"/><path d="M21 15h-8"/><path d="M11 9H3"/></svg>`;
const realIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 color-real"><path d="M13 2L3 14h9l-1 8l10-12h-9l1-8z"/></svg>`;
const mindIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 color-mind"><path d="M19.7 18.7a2.8 2.8 0 01-3.3 0L12 15l-4.4 3.7a2.8 2.8 0 01-3.3 0L2 16V4a2 2 0 012-2h16a2 2 0 012 2v12l-2.3 2.7z"/><path d="M12 12V6"/><path d="M12 18V15"/></svg>`; 
const homeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 color-home"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const outsideIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 color-outside"><path d="M18 2h-3a5 5 0 00-5 5v14l-4-4l-4 4V10"/><circle cx="12" cy="7" r="5"/></svg>`;
const horrorIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 color-horror"><path d="M12 21.5C17.25 21.5 21.5 17.25 21.5 12C21.5 6.75 17.25 2.5 12 2.5C6.75 2.5 2.5 6.75 2.5 12C2.5 17.25 6.75 21.5 12 21.5Z"/><path d="M12 2.5V21.5"/><path d="M6 12h12"/><path d="M18 6L6 18"/><path d="M6 6L18 18"/></svg>`; 

const arcanaIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 text-yellow-400"><circle cx="12" cy="12" r="7"/><path d="M12 19V5"/><path d="M5 12h14"/><path d="M19.07 4.93L4.93 19.07"/><path d="M19.07 19.07L4.93 4.93"/></svg>`;


const adventureBlueprints = [
    
    { type: 'story', title: "The Temporal Bookmark", description: "You open your favorite book and find a note with tomorrow's date.", reward: "A paradox! You've successfully navigated a time warp. Your prize: you can take a 5-minute break *without* guilt.", storyGraph: { 'start': { text: "The note reads: 'Don't eat the blue one.' You have two identical energy bars on your desk: one red, one blue. What do you do?", choices: [{ text: "Eat the red one", target: "end_red" }, { text: "Eat the blue one, despite the warning", target: "end_blue" }, { text: "Eat neither", target: "end_neither" }] }, 'end_red': { text: "You eat the red bar. It tastes like raspberries and regret. Nothing happens. Mission complete... maybe?", choices: [] }, 'end_blue': { text: "You eat the blue one. It tastes like mint and static electricity. Suddenly, you feel a strong urge to alphabetize your spice rack. You've changed the past, mildly.", choices: [] }, 'end_neither': { text: "You throw the bars away. You don't have time for temporal food games. You maintain the timeline. Victory through caution.", choices: [] } } },
    
    { type: 'real', title: "The Shadow Puppet Master", description: "You must create three (3) distinct shadow puppets on the wall using only your hands and a light source.", steps: [ "1. Find a lamp or flashlight and face a blank wall.", "2. Shadow 1: The Rabbit (Classic ears, wiggling nose).", "3. Shadow 2: The Flying Bird (Two hands flapping).", "4. Shadow 3: The Wolf/Dog (Profile view, opening jaw).", "5. Give your shadow puppets a one-sentence dramatic performance.", ], reward: "You've earned the title: Master of the Silent Arts. Fact: Shadow puppetry has existed for over 1,000 years." },
    { type: 'real', title: "Mindful Water Break", description: "Your quest: drink one full glass of water, focusing only on the sensation of drinking.", steps: [ "1. Get a glass of water.", "2. Sit down, close your eyes (or keep them open).", "3. Notice the temperature of the glass and the water.", "4. Take slow sips, noticing the taste and feeling as you swallow.", "5. Finish the glass. Hydration complete!", ], reward: "A refreshing +10 to Health and Focus. You are now a well-hydrated hero." },
    { type: 'real', title: "The One-Minute Stretch", description: "You feel the creeping fatigue of the sedentary life. Perform a simple, full-body stretch for 60 seconds.", steps: [ "1. Stand up and reach hands to the sky (15 seconds).", "2. Touch your toes (15 seconds).", "3. Perform neck rolls (15 seconds).", "4. Do a chest-opening stretch by clasping your hands behind your back (15 seconds).", ], reward: "Your body alignment score is now maxed! +1 Vitality." },

    { type: 'mind', title: "The Five Senses Log", description: "Write down one thing you can currently Hear, See, Smell, Taste, and Feel (touch).", steps: [ "1. Hear: (e.g., traffic outside).", "2. See: (e.g., the color of your screen).", "3. Smell: (e.g., dust, faint perfume).", "4. Taste: (e.g., coffee residual).", "5. Feel: (e.g., the texture of your clothes).", ], reward: "You are fully present! +5 Mindfulness. This exercise helps reduce stress." },
    { type: 'mind', title: "Future Self Letter", description: "Write one short sentence about what you want your future self to remember about today.", steps: [ "1. Grab a piece of paper or open a note app.", "2. Write the date.", "3. Write your sentence (e.g., 'Remember how quiet the morning was').", "4. Fold it up and put it somewhere safe (like a book or drawer).", ], reward: "A message has been sent through time! Future you will appreciate this moment." },
    { type: 'mind', title: "The Inbox Zero Mini-Boss", description: "Delete or archive the last 5 non-essential emails in your inbox.", steps: [ "1. Open your inbox (the source of digital chaos).", "2. Identify 5 pieces of spam, newsletters, or ancient notifications.", "3. Dispatch them (delete/archive).", "4. Enjoy the brief, sweet taste of digital cleanliness.", ], reward: "The digital horde has been thinned! Congratulations on your mini-purge." },
    { type: 'mind', title: "The Goal Fragmenter", description: "Write down one large goal you have, and then write down the very first tiny action required to start it.", steps: [ "1. Write down a scary, big goal (e.g., 'Write a book').", "2. Below it, write the *first 5 minute action* (e.g., 'Find a blank document').", "3. You are not required to do the action, only define it.", ], reward: "The journey of a thousand miles begins with a perfectly defined first step. Strategy unlocked." },

    { type: 'home', title: "The Mug Sentinel Duty", description: "All mugs must be where they belong. Move any stray mugs from your work area to the kitchen sink or dishwasher.", steps: [ "1. Scan your area for misplaced mugs (maximum 3).", "2. Carefully transport the mugs to the kitchen.", "3. Place them directly in the sink or dishwasher.", ], reward: "Mug Sanity restored. +10 to Kitchen Hygiene Score." },
    { type: 'home', title: "The Light Switch Cleanse", description: "The most-touched surfaces are the dirtiest. Clean one light switch or doorknob.", steps: [ "1. Find a cleaning wipe or spray/cloth.", "2. Choose one light switch or door knob.", "3. Wipe it down thoroughly.", "4. Behold its temporary shining glory.", ], reward: "Bacterial threat level reduced by 80%. +1 Vandalism (Good kind)." },
    { type: 'home', title: "The Vertical Dust Hunt", description: "Dust one often-forgotten vertical surface (e.g., a door frame, a bookshelf side, or a picture frame top).", steps: [ "1. Identify a dusty vertical surface above eye level.", "2. Find a cleaning cloth or duster.", "3. Perform the vertical dust-kill mission.", ], reward: "Hidden dust colonies eradicated. Air Quality +5." },
    { type: 'home', title: "The Pillow Fluff Ritual", description: "Plump up or reposition all cushions and pillows on your nearest piece of furniture (sofa, chair, bed).", steps: [ "1. Approach the target seating/resting area.", "2. Fluff all pillows with vigor.", "3. Reposition them symmetrically or aesthetically.", ], reward: "Comfort Level maximized. Environment Score +1." },

    { type: 'outside', title: "The Sky Scrutiny", description: "Go outside, look up, and identify the most interesting cloud or aerial object (bird, plane, etc.).", steps: [ "1. Step outside or look out a window.", "2. Locate the most visually interesting thing in the sky.", "3. Describe it to yourself in one sentence (e.g., 'That cumulus cloud looks like a melting ice cream cone').", ], reward: "Observation skill unlocked. You have documented the ephemeral heavens." },
    { type: 'outside', title: "The Natural Texture Log", description: "Find and briefly touch three different natural textures (e.g., bark, leaf, stone, soil).", steps: [ "1. Step outside.", "2. Touch a rough texture (e.g., tree bark).", "3. Touch a smooth texture (e.g., a petal or smooth stone).", "4. Touch a soft or brittle texture (e.g., a dead leaf or grass).", ], reward: "Tactile Sensation confirmed. You are grounded in nature." },
    { type: 'outside', title: "The Soundscape Anchor", description: "Find a spot outside and listen for 60 seconds. Identify the furthest and closest sound.", steps: [ "1. Find a quiet place outdoors.", "2. Close your eyes and listen for one minute.", "3. Identify the loudest/closest sound (e.g., my own breathing).", "4. Identify the quietest/furthest sound (e.g., a siren three blocks away).", ], reward: "Acoustic perception improved. You hear the deep hum of the world." },
    { type: 'outside', title: "The Neighborhood Color ID", description: "Find three objects outside that are all the same color, but not green (e.g., three blue cars, three red bricks).", steps: [ "1. Choose a non-green color (e.g., Yellow).", "2. Find a Yellow object 1.", "3. Find a Yellow object 2.", "4. Find a Yellow object 3.", ], reward: "Environmental pattern recognition achieved. +10 Explorer XP." },

    { type: 'horror', title: "The Ghostly Reflection", description: "Look into a dark mirror or dark window for five seconds and imagine you see something behind you.", steps: [ "1. Approach a reflective surface in a dimly lit room.", "2. Stare directly at your reflection.", "3. Hold the gaze for a count of five.", "4. Quickly glance over your shoulder (just to be sure).", ], reward: "The specter has been acknowledged. Sanity check passed (barely)." },
    { type: 'horror', title: "The Darkness Protocol", description: "Turn off the nearest source of light and operate for 30 seconds only by memory.", steps: [ "1. Identify a light switch/lamp.", "2. Turn the light OFF.", "3. Navigate or perform a simple task (like picking up a pen) in the dark for 30 seconds.", "4. Turn the light back on. Mission complete!", ], reward: "Night Vision Mode unlocked. You fear the dark less." },
    { type: 'horror', title: "The Creepy Jingle", description: "Sing or hum a nursery rhyme in the darkest, creepiest voice you can manage.", steps: [ "1. Choose a simple, cheerful rhyme (e.g., Twinkle, Twinkle).", "2. Get your deepest, most unsettling voice ready.", "3. Perform the creepy jingle.", "4. Immediately laugh to break the spell.", ], reward: "The Curse of Monotony has been broken by unexpected melody. Spook Factor +1." },
    { type: 'horror', title: "The Uncanny Valley Object", description: "Pick up a common, inanimate object (e.g., a rubber duck, a spoon) and give it human-like mannerisms for 10 seconds.", steps: [ "1. Select your object.", "2. Hold it like it's listening to you.", "3. Make it 'nod' or 'shiver' while you hold it.", "4. Place it back and treat it like a normal object again.", ], reward: "You have stared into the void of personification. Object Interaction Level Up." },

    { type: 'arcana', title: "The Observer's Dilemma", description: "The core challenge is not what you see, but the space between the observer and the observed.", steps: [ "1. Define one abstract concept (e.g., 'Justice' or 'Time').", "2. Write down three words that define it, and three words that are its opposite.", "3. Ponder the relationship: Can the concept exist without its opposite?", "4. Decide if your personal definition changed after step 3.", ], reward: "You have engaged the higher cognitive matrix. +1 Philosophy." },
    { type: 'arcana', title: "The Unlearning Protocol", description: "Identify one firm, long-held belief you possess and spend 5 minutes arguing against it.", steps: [ "1. Name your belief (e.g., 'Coffee is essential').", "2. Write three reasons why the opposite might be true ('Coffee is a net drain on energy', 'It causes dependency', 'There are better alternatives').", "3. Spend 5 minutes considering those opposing reasons seriously.", ], reward: "Cognitive flexibility achieved. Your intellectual frontiers have expanded." },
    { type: 'arcana', title: "The Empathy Switch", description: "Look at the nearest stranger (or imagine one clearly). Write a three-sentence internal monologue from their perspective.", steps: [ "1. Choose a person (e.g., 'The person walking by my window').", "2. Write a sentence about their immediate physical feeling (e.g., 'My feet are tired, I hope this bag doesn't break').", "3. Write a sentence about a small, mundane worry (e.g., 'Did I remember to turn off the stove?').", "4. Write a sentence about a quiet, long-term hope (e.g., 'I really hope that promotion comes through next month').", ], reward: "Inter-Subjective Field Projection completed. Empathy score +10." },
];


const titleEl = document.getElementById('adventure-title');
const descEl = document.getElementById('adventure-desc');
const stepsEl = document.getElementById('adventure-steps');
const rewardEl = document.getElementById('adventure-reward');
const newAdventureBtn = document.getElementById('new-adventure-btn');
const donateBtn = document.getElementById('donate-btn'); 
const adventureContentEl = document.getElementById('adventure-content');
const loadingScreenEl = document.getElementById('loading-screen');
const mainContentEl = document.getElementById('main-content');
const loadingStatusEl = document.getElementById('loading-status');
const arcanaStatusEl = document.getElementById('arcana-status');
const arcanaProgressEl = document.getElementById('arcana-progress');
const progressTextEl = document.getElementById('progress-text');
const userInfoEl = document.getElementById('user-info');

const donationModal = document.getElementById('donation-modal');
const closeDonationBtn = document.getElementById('close-donation-btn');
const cryptoAddressEl = document.getElementById('crypto-address'); 
const copyStatusEl = document.getElementById('copy-status');


const USER_STATUS_COLLECTION = 'user_data';
const USER_STATS_DOC_ID = 'stats';

function getUserStatsDocRef() {
    if (!db || !userId) return null;
    
    const path = `artifacts/${appId}/users/${userId}/${USER_STATUS_COLLECTION}/${USER_STATS_DOC_ID}`;
    return doc(db, path);
}

async function incrementAdventureCount() {
    if (!userId) return;
    const docRef = getUserStatsDocRef();
    if (docRef) {
        const newCount = adventureCount + 1;
        await setDoc(docRef, { adventureCount: newCount }, { merge: true });
    }
}

function setupStatsListener() {
    if (!db || !userId) return;

    const docRef = getUserStatsDocRef();
    if (docRef) {
        onSnapshot(docRef, (doc) => {
            const data = doc.data();
            adventureCount = data?.adventureCount || 0;
            
            const oldArcanaStatus = hasArcanaKey;
            hasArcanaKey = adventureCount >= UNLOCK_THRESHOLD;
            
            updateArcanaKeyUI();

            if (!oldArcanaStatus && hasArcanaKey) {
                unlockSound();
            }
            
        }, (error) => {
            console.error("Firestore Error on Stats Snapshot:", error);
            arcanaStatusEl.textContent = "Arcana Status: Connection Error";
            arcanaStatusEl.classList.remove('unlocked-arcana');
            arcanaStatusEl.classList.add('text-red-500');
        });
    }
}

function updateArcanaKeyUI() {
    const progressPercent = Math.min(100, (adventureCount / UNLOCK_THRESHOLD) * 100);
    arcanaProgressEl.style.width = `${progressPercent}%`;
    progressTextEl.textContent = `${Math.round(progressPercent)}%`;

    if (hasArcanaKey) {
        arcanaStatusEl.textContent = `Arcana Key: ACTIVATED (Tier III Unlocked!)`;
        arcanaStatusEl.classList.remove('text-violet-300');
        arcanaStatusEl.classList.add('unlocked-arcana', 'font-extrabold');
    } else {
        arcanaStatusEl.textContent = `Arcana Key Progress: ${adventureCount} / ${UNLOCK_THRESHOLD} Adventures`;
        arcanaStatusEl.classList.add('text-violet-300');
        arcanaStatusEl.classList.remove('unlocked-arcana', 'font-extrabold');
    }
}

async function firebaseInit() {
    if (!firebaseConfig) {
        console.error("Firebase config is missing.");
        loadingStatusEl.textContent = "System Error: Firebase Config Missing.";
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        loadingStatusEl.textContent = "Authenticating user...";
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        loadingStatusEl.textContent = "Establishing secure connection...";
        await new Promise(resolve => {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    userId = user.uid;
                    userInfoEl.textContent = `User ID: ${userId.substring(0, 8)}...`;
                    loadingStatusEl.textContent = "Fetching user data...";
                    setupStatsListener();
                } else {
                    userInfoEl.textContent = 'User ID: Anonymous (No UID)';
                }
                resolve();
            });
        });
        
        loadingStatusEl.textContent = "Reality Stream Established. Ready.";
    } catch (error) {
        console.error("Firebase initialization or login error:", error);
        loadingStatusEl.textContent = `Initialization Failed: ${error.code}`;
    }
}

function showReward(rewardText) {
    rewardEl.innerHTML = `<strong class="font-extrabold text-cyan-200">REWARD:</strong> ${rewardText}`;
    setTimeout(() => {
        rewardEl.classList.add('show');
        successSound();
    }, 50); 
}

function renderStaticAdventure(adventure) {
    stepsEl.innerHTML = ''; 
    const stepsList = document.createElement('ul');
    stepsList.className = 'space-y-3 list-none';
    
    adventure.steps.forEach(stepText => {
        const li = document.createElement('li');
        li.className = 'quest-log-entry bg-white/10 p-4 rounded-xl flex items-start shadow-inner transition-all duration-200';
        li.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-cyan-400 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-gray-50 text-base font-medium">${stepText}</span>`;
        stepsList.appendChild(li);
    });
    
    stepsEl.appendChild(stepsList);
    showReward(adventure.reward);
}

function renderStoryNode(adventure, nodeKey) {
    choiceClick(); 
    
    const node = adventure.storyGraph[nodeKey];
    stepsEl.innerHTML = ''; 
    
    rewardEl.classList.remove('show');
    setTimeout(() => rewardEl.innerHTML = '', 400); 

    const textEl = document.createElement('p');
    textEl.className = 'text-lg text-white italic mb-6 text-center bg-white/5 p-4 rounded-xl border border-white/10 font-medium';
    textEl.textContent = node.text;
    stepsEl.appendChild(textEl);

    if (node.choices && node.choices.length > 0) {
        const choicesContainer = document.createElement('div');
        choicesContainer.className = 'space-y-4';
        
        node.choices.forEach(choice => {
            const button = document.createElement('button');
            button.className = 'choice-button bg-violet-600/70 border border-violet-500 text-white font-semibold py-3 px-5 rounded-xl w-full text-left transition-all duration-200 transform hover:bg-violet-500/90 flex justify-between items-center shadow-lg active:scale-98 text-base';
            button.innerHTML = `
                <span>${choice.text}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-cyan-200 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
            `;
            button.onclick = () => renderStoryNode(adventure, choice.target);
            choicesContainer.appendChild(button);
        });
        
        stepsEl.appendChild(choicesContainer);
    } else {
        showReward(adventure.reward);
    }
}

function generateAdventure() {
    
    const availableTypes = ['story', 'real', 'mind', 'home', 'outside', 'horror'];
    if (hasArcanaKey) {
        availableTypes.push('arcana');
    }

    const availableAdventures = adventureBlueprints.filter(a => availableTypes.includes(a.type));
    if (availableAdventures.length === 0) {
        titleEl.innerHTML = `<span>No Adventures Available</span>`;
        descEl.textContent = "Please wait for system initialization or check your Arcana Key status.";
        return;
    }

    const adventure = availableAdventures[Math.floor(Math.random() * availableAdventures.length)];
    let icon, titleColorClass;

    switch(adventure.type) {
        case 'story': 
            icon = storyIcon; 
            titleColorClass = 'color-story'; 
            break;
        case 'real': 
            icon = realIcon; 
            titleColorClass = 'color-real'; 
            break;
        case 'mind': 
            icon = mindIcon; 
            titleColorClass = 'color-mind'; 
            break;
        case 'home': 
            icon = homeIcon; 
            titleColorClass = 'color-home'; 
            break;
        case 'outside': 
            icon = outsideIcon; 
            titleColorClass = 'color-outside'; 
            break;
        case 'horror': 
            icon = horrorIcon; 
            titleColorClass = 'color-horror'; 
            break;
        case 'arcana': 
            icon = arcanaIcon; 
            titleColorClass = 'unlocked-arcana'; 
            break;
        default:
            icon = '';
            titleColorClass = 'text-violet-100';
    }

    titleEl.className = `text-3xl md:text-4xl font-extrabold mb-4 text-center flex items-center justify-center space-x-3 min-h-[48px] drop-shadow-lg ${titleColorClass}`;
    titleEl.innerHTML = `${icon} <span class="tracking-widest">${adventure.title}</span>`;
    descEl.textContent = adventure.description;

    rewardEl.classList.remove('show');
    rewardEl.innerHTML = '';
    
    if (adventure.type === 'story') {
        renderStoryNode(adventure, 'start');
    } else {
        renderStaticAdventure(adventure);
    }
}

async function onNewAdventureClick() {
    startClick(); 
    newAdventureBtn.disabled = true;
    newAdventureBtn.textContent = 'Generating...';

    adventureContentEl.classList.add('content-fade-out');
    
    await incrementAdventureCount();

    setTimeout(() => {
        generateAdventure();

        adventureContentEl.classList.remove('content-fade-out');
        adventureContentEl.classList.add('content-fade-in');

        newAdventureBtn.disabled = false;
        newAdventureBtn.textContent = 'Generate Perfect Adventure';

        setTimeout(() => {
            adventureContentEl.classList.remove('content-fade-in');
        }, 400);
    }, 300);
}

function openDonationModal() { donationModal.classList.remove('hidden'); }
function closeDonationModal() { donationModal.classList.add('hidden'); copyStatusEl.classList.add('hidden'); }

function copyAddressToClipboard(addressEl, statusEl, successMessage) {
    const address = addressEl.textContent.trim();
    const tempInput = document.createElement('input');
    tempInput.value = address;
    document.body.appendChild(tempInput);
    tempInput.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            statusEl.textContent = successMessage;
            statusEl.classList.remove('text-red-400');
            statusEl.classList.add('text-green-400');
            choiceSynth.triggerAttackRelease("C6", "16n"); 
        } else {
            throw new Error("Copy command failed.");
        }
    } catch (err) {
        console.error('Copy failed:', err);
        statusEl.textContent = "Copy Failed: Please manually select and copy the address.";
        statusEl.classList.remove('text-green-400');
        statusEl.classList.add('text-red-400');
    }
    
    document.body.removeChild(tempInput);
    statusEl.classList.remove('hidden');
    
    setTimeout(() => {
        statusEl.classList.add('hidden');
    }, 3000);
}


document.addEventListener('DOMContentLoaded', async () => {
    await firebaseInit(); 

    newAdventureBtn.addEventListener('click', onNewAdventureClick);
    donateBtn.addEventListener('click', openDonationModal);
    closeDonationBtn.addEventListener('click', closeDonationModal);
    cryptoAddressEl.addEventListener('click', () => {
        copyAddressToClipboard(cryptoAddressEl, copyStatusEl, "SOL Address Copied to Clipboard!");
    });

    setTimeout(() => {
        loadingScreenEl.style.opacity = 0;
        setTimeout(() => {
            loadingScreenEl.style.display = 'none';
            mainContentEl.classList.remove('hidden');
            
            generateAdventure();
            adventureContentEl.classList.add('content-fade-in');
            setTimeout(() => {
                adventureContentEl.classList.remove('content-fade-in');
            }, 400);
        }, 500);
    }, 1000);
});
</script>