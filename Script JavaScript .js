 const $ = id => document.getElementById(id);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ===== TALLY CONFIG =====
  const TALLY_FORM_ID = "1A4Ajp";
  const TALLY_BASE_URL = `https://tally.so/r/${TALLY_FORM_ID}`;

// ===== FOURTHWALL CONFIG =====
const FW_STOREFRONT_TOKEN = "ptkn_f9e58f99-75f2-42c3-bc33-6bdcb04c50e1";
const FW_API_BASE = "https://storefront-api.fourthwall.com/v1";
const FW_CHECKOUT_DOMAIN = "dj-moy-shop.fourthwall.com";

// Map our logical services -> Fourthwall variant IDs
const FW_VARIANTS = {
  // Core services
  masterOnly: "33435bba-ca97-4c76-98de-86430ba6286e",

  mixOnly_1_4:  "268a008e-6fb3-4cd2-b3dd-76c1dfcd6074",
  mixOnly_5_8:  "57bf5428-c8e3-4f9a-bd36-a7331efd6c6c",
  mixOnly_9_16: "ed140375-2b43-4246-93d2-362bc4971dda",
  mixOnly_17_24:"8afc82bd-2831-47db-bd18-26d0b41729bf",

  mixMaster_1_4:  "ee466308-52ea-48ff-885b-9ad1c8dc6005",
  mixMaster_5_8:  "32b246c4-5d2d-4976-b0ff-5b7039dc1f28",
  mixMaster_9_16: "1c242db5-8ae2-4129-bf93-51b61b460a83",
  mixMaster_17_24:"0d5adf90-9d3b-4d6c-b28b-7d1a928f1cda",

  // Add-ons
  vocalUpgrade:   "47d8cbf3-f1d0-493d-8686-8779b4de6e23",
  noiseCleanup:   "fcff8cf8-381e-4e87-8463-91ae6728da49",
  extraRevision:  "64772271-f04b-4586-85b0-da9b8b42b9d0",
  priorityDelivery:"5e092988-6c51-425d-b1ee-a0f81148bd64",

  // Custom project / quote
  customProject:  "a80fdabc-6ecb-4078-9d14-8c163ce4347c"
};

  // Shared metadata (current song)
  const metaState = {
    artistName: "",
    songTitle: "",
    genre: "",
    bpm: "",
    key: "",
    extraNotes: ""
  };

  // Guided mode project songs
  const guidedSongs = []; // { artistName, songTitle, summary }
  let guidedSongIndex = 1;

  // Manual mode project songs
  const manualSongs = [];

  function buildServicesLabel(mix, master){
    if (mix && master) return "Mix + Master";
    if (mix) return "Mix";
    if (master) return "Master";
    return "";
  }

  function buildAddonsLabelFromGuided(){
    const a = [];
    if (guidedState.addons.noiseReduction) a.push("Noise cleanup");
    if (guidedState.addons.vocalUpgrade) a.push("Vocal Upgrade");
    if (guidedState.addons.priority) a.push("Priority delivery");
    if (guidedState.addons.extraRevision) a.push("Extra revision");
    return a;
  }

  function buildAddonsLabelFromManual(){
    const a = [];
    if (manualState.addons.noise) a.push("Noise cleanup");
    if (manualState.addons.vocal) a.push("Vocal Upgrade");
    if (manualState.addons.priority) a.push("Priority delivery");
    if (manualState.addons.revision) a.push("Extra revision");
    return a;
  }

  function updateSongCounter(){
    const el = $("songCounter");
    if (!el) return;
    el.textContent = `Song ${guidedSongIndex}`;
  }

  function updateManualSongNumber(){
    const total = manualSongs.length + 1;
    const current = total;
    $("manualSongNumber").textContent = `Song ${current} of ${total}`;
  }

  /* -------- MODE SWITCH -------- */
  function showMode(mode){
    $("entryMode").classList.toggle("hidden", mode !== "entry");
    $("guidedMode").classList.toggle("hidden", mode !== "guided");
    $("manualMode").classList.toggle("hidden", mode !== "manual");
    window.scrollTo({top:0});
  }

  $("btnEntryGuided").addEventListener("click", ()=> showMode("guided"));
  $("btnEntryManual").addEventListener("click", ()=> showMode("manual"));
  $("manualBackToEntry").addEventListener("click", ()=> showMode("entry"));

  /* ========= GUIDED MODE ========= */

  const guidedState = {
    trackType: null,
    goal: null,
    issues: new Set(),
    stems: { tier: null },
    addons: {
      noiseReduction:false,
      vocalUpgrade:false,
      priority:false,
      extraRevision:false
    },
    unsure:{ track:false, goal:false },
    addonsInitialized:false
  };

  const guidedRec = {
    mixing:false,
    mastering:false,
    vocalUpgrade:false,
    noiseReduction:false,
    stemTier:null,
    headline:"",
    bullets:[],
    warning:null
  };

  const addonAutoReasons = { noise:null, vocal:null };
  let stepIndex = 0;

  function steps(){
    return [
      {id:"stepTrack", label:"Track"},
      {id:"stepGoal", label:"Goal"},
      {id:"stepIssues", label:"Issues"},
      {id:"stepStemsInfo", label:"Stems Info"},
      {id:"stepStemsCount", label:"Stems"},
      {id:"stepAddons", label:"Add-ons"},
      {id:"stepRec", label:"Recommendation"},
      {id:"stepDetails", label:"Details"},
      {id:"stepReview", label:"Review"}
    ];
  }

  function renderStepper(){
    const s = steps();
    $("stepsBar").innerHTML = "";
    s.forEach((_, idx)=>{
      const d = document.createElement("div");
      d.className = "stepDot" + (idx <= stepIndex ? " on" : "");
      $("stepsBar").appendChild(d);
    });
    $("stepLabel").textContent = `${stepIndex+1}/${s.length} • ${s[stepIndex].label}`;
  }

  function shouldNeedStemsFlow(){
    const t = guidedState.trackType;
    const g = guidedState.goal;
    const hasMulti = (t === "stems" || t === "vocals_beat");
    const wantsMix = (
      g === "release_ready" ||
      g === "improve_mix" ||
      g === "vocals" ||
      g === "problems" ||
      g === "goal_unsure"
    );
    return hasMulti && wantsMix;
  }

  function canGoNext(){
    const id = steps()[stepIndex].id;
    if (id === "stepTrack") return !!guidedState.trackType;
    if (id === "stepGoal") return !!guidedState.goal;
    if (id === "stepIssues") return true;
    if (id === "stepStemsInfo") return true;
    if (id === "stepStemsCount"){
      if (!shouldNeedStemsFlow()) return true;
      return !!guidedState.stems.tier;
    }
    if (id === "stepAddons") return true;
    if (id === "stepRec") return true;
    if (id === "stepDetails"){
      return metaState.artistName.trim() !== "" && metaState.songTitle.trim() !== "";
    }
    if (id === "stepReview") return true;
    return true;
  }

  function updateNextState(){
    $("btnNext").disabled = !canGoNext();
  }

  function showStep(idx){
    const s = steps();
    stepIndex = Math.max(0, Math.min(idx, s.length-1));
    qsa(".step").forEach(el=>el.classList.add("hidden"));
    $(s[stepIndex].id).classList.remove("hidden");
    $("btnBack").disabled = false;
    $("btnNext").textContent = (s[stepIndex].id === "stepReview") ? "Upload" : "Next";
    renderStepper();

    const id = s[stepIndex].id;
    if (id === "stepAddons"){
      ensureAddonsInitialized();
      syncAddonsUI();
    }
    if (id === "stepRec") buildRecommendation();
    if (id === "stepReview") renderReview();

    updateNextState();
    window.scrollTo({top:0, behavior:"smooth"});
  }

  function bindSingle(gridId, key, countId, unsureKey, attr){
    const items = qsa(`#${gridId} .pillCard`);
    items.forEach(el=>{
      el.addEventListener("click", ()=>{
        items.forEach(x=>x.classList.remove("selected"));
        el.classList.add("selected");
        const v = el.getAttribute(attr);
        guidedState[key] = v;
        if (countId) $(countId).textContent = "1";
        if (unsureKey){
          guidedState.unsure[unsureKey] = (v === `${unsureKey}_unsure`);
        }
        updateNextState();
      });
    });
  }

  function bindIssues(){
    const items = qsa("#issuesGrid .pillCard");
    items.forEach(el=>{
      el.addEventListener("click", ()=>{
        const v = el.getAttribute("data-issue");
        if (v === "none"){
          guidedState.issues.clear();
          items.forEach(x=>x.classList.remove("selected"));
          el.classList.add("selected");
          guidedState.issues.add("none");
          $("issuesCount").textContent = "0";
          updateNextState();
          return;
        }
        if (guidedState.issues.has("none")){
          guidedState.issues.delete("none");
          const noneEl = items.find(x=>x.getAttribute("data-issue")==="none");
          if (noneEl) noneEl.classList.remove("selected");
        }
        const isOn = el.classList.toggle("selected");
        if (isOn) guidedState.issues.add(v); else guidedState.issues.delete(v);
        $("issuesCount").textContent = String(guidedState.issues.size);
        updateNextState();
      });
    });
  }

  function bindStemsCount(){
    const items = qsa("#tierGrid .pillCard");
    items.forEach(el=>{
      el.addEventListener("click", ()=>{
        items.forEach(x=>x.classList.remove("selected"));
        el.classList.add("selected");
        guidedState.stems.tier = el.getAttribute("data-tier");
        $("tierCount").textContent = "1";
        updateNextState();
      });
    });
  }

  function inferNoiseReason(base){
    const issues = guidedState.issues;
    const t = guidedState.trackType;
    const g = guidedState.goal;
    if (issues.has("noise"))
      return "you mentioned noise / hiss / hum in your audio.";
    if (t === "raw_recording")
      return "you’re working from a raw recording where room noise is common.";
    if (g === "problems")
      return "you said your audio has problems that need fixing.";
    return "your earlier answers suggested noise cleanup would help.";
  }

  function inferVocalReason(base){
    const issues = guidedState.issues;
    const g = guidedState.goal;
    const t = guidedState.trackType;
    if (g === "vocals")
      return "you said you want your vocals to sound professional.";
    if (issues.has("vocals_tone") || issues.has("vocals_balance"))
      return "you mentioned issues with vocal clarity or vocal/beat balance.";
    if (t === "vocals_beat")
      return "you’re working with separate vocals and a beat.";
    return "your earlier answers suggested a vocal upgrade would help.";
  }

  function ensureAddonsInitialized(){
    if (guidedState.addonsInitialized) return;
    const base = computeRecBase();
    if (base.suggestNoise){
      guidedState.addons.noiseReduction = true;
      addonAutoReasons.noise = inferNoiseReason(base);
    }
    if (base.suggestVocalUpgrade){
      guidedState.addons.vocalUpgrade = true;
      addonAutoReasons.vocal = inferVocalReason(base);
    }
    guidedState.addonsInitialized = true;
  }

  function bindAddons(){
    const items = qsa("#addonsGrid .pillCard");
    items.forEach(el=>{
      el.addEventListener("click", ()=>{
        const key = el.getAttribute("data-addon");
        const isSelected = el.classList.toggle("selected");
        if (key === "noise") guidedState.addons.noiseReduction = isSelected;
        if (key === "vocal") guidedState.addons.vocalUpgrade = isSelected;
        if (key === "priority") guidedState.addons.priority = isSelected;
        if (key === "revision") guidedState.addons.extraRevision = isSelected;
        syncAddonsUI();
      });
    });
  }

  function syncAddonsUI(){
    const items = qsa("#addonsGrid .pillCard");
    items.forEach(el=>{
      const key = el.getAttribute("data-addon");
      let on = false;
      if (key === "noise") on = guidedState.addons.noiseReduction;
      if (key === "vocal") on = guidedState.addons.vocalUpgrade;
      if (key === "priority") on = guidedState.addons.priority;
      if (key === "revision") on = guidedState.addons.extraRevision;
      el.classList.toggle("selected", !!on);
    });

    const noiseNote = $("autoNoteNoise");
    const vocalNote = $("autoNoteVocal");

    if (noiseNote){
      if (addonAutoReasons.noise && guidedState.addons.noiseReduction){
        noiseNote.textContent = `Auto-selected because ${addonAutoReasons.noise}`;
      } else {
        noiseNote.textContent = "";
      }
    }
    if (vocalNote){
      if (addonAutoReasons.vocal && guidedState.addons.vocalUpgrade){
        vocalNote.textContent = `Auto-selected because ${addonAutoReasons.vocal}`;
      } else {
        vocalNote.textContent = "";
      }
    }
  }

  function computeRecBase(){
    const base = {
      mixing:false,
      mastering:false,
      suggestVocalUpgrade:false,
      suggestNoise:false,
      warning:null,
      notes:[]
    };

    const t = guidedState.trackType;
    const g = guidedState.goal;
    const issues = guidedState.issues;

    const vocalsIssues = issues.has("vocals_tone") || issues.has("vocals_balance");
    const noiseIssues = issues.has("noise");
    const harshIssues = issues.has("harsh_muddy");

    if (g === "release_ready"){ base.mixing=true; base.mastering=true; }
    if (g === "improve_mix"){ base.mixing=true; }
    if (g === "master_only"){ base.mastering=true; }
    if (g === "vocals"){ base.mixing=true; base.suggestVocalUpgrade=true; }
    if (g === "problems"){ base.mixing=true; base.suggestNoise=true; }
    if (g === "goal_unsure"){ base.mixing=true; base.mastering=true; }

    if (t === "finished_song"){
      if (base.mixing || base.suggestVocalUpgrade){
        base.warning = "With one mixed file, true mixing or deep vocal work is limited. For full control, stems or at least separate vocal + beat files are best.";
      }
      base.mixing=false;
      base.suggestVocalUpgrade=false;
      base.mastering=true;
    }

    if (t === "vocals_beat"){
      if (g === "master_only"){
        base.mixing=false;
        base.mastering=true;
      } else {
        base.mixing=true;
      }
      if (g === "vocals" || vocalsIssues){
        base.suggestVocalUpgrade=true;
      }
    }

    if (t === "stems"){
      if (!base.mixing && !base.mastering){
        base.mixing=true;
      }
    }

    if (t === "raw_recording"){
      base.suggestNoise=true;
      if (!base.mixing && !base.mastering){
        base.mastering=true;
      }
    }

    if (t === "track_unsure"){
      base.mastering=true;
      base.notes.push("You selected “I’m not sure” for your files. I’m defaulting to a safe path; on the upload page you can clarify what you have.");
    }

    if (noiseIssues) base.suggestNoise=true;
    if (vocalsIssues || g === "vocals") base.suggestVocalUpgrade=true;
    if (harshIssues && !base.mixing && t !== "finished_song"){
      base.mixing=true;
    }

    return base;
  }

  function prettyStemTier(t){
    const map = {
      "1-4":"1–4 stems",
      "5-8":"5–8 stems",
      "9-16":"9–16 stems",
      "17-24":"17–24 stems",
      "25+":"25+ stems (custom quote)"
    };
    return map[t] || t || "";
  }

  function buildRecommendation(){
    const base = computeRecBase();

    guidedRec.mixing = base.mixing;
    guidedRec.mastering = base.mastering;
    guidedRec.vocalUpgrade = guidedState.addons.vocalUpgrade;
    guidedRec.noiseReduction = guidedState.addons.noiseReduction;
    guidedRec.stemTier = guidedState.stems.tier;
    guidedRec.warning = base.warning;
    guidedRec.bullets = [];
    guidedRec.headline = "";

    const serviceLabel =
      (guidedRec.mixing && guidedRec.mastering) ? "🚀 Release-Ready Package" :
      (guidedRec.mixing) ? "🎚 Mixing" :
      "🎧 Mastering";

    const translation =
      (guidedRec.mixing && guidedRec.mastering) ? "(Mix + Master)" :
      (guidedRec.mixing) ? "(Mix)" :
      "(Master)";

    let unsureTag = "";
    if (guidedState.unsure.track || guidedState.unsure.goal){
      unsureTag = `<br/><span style="color:var(--muted2);font-size:12px;">You chose “I’m not sure” — this is the safest path based on your answers.</span>`;
    }

    guidedRec.headline = `<strong>Best fit:</strong> ${serviceLabel} <span style="color:var(--muted2);font-weight:800;">${translation}</span>${unsureTag}`;
    $("recHeadline").innerHTML = guidedRec.headline;

    const bullets = [];

    if (guidedRec.mixing && guidedRec.mastering){
      bullets.push("We’ll build a clean, balanced mix, then finalize loudness and polish for release.");
    } else if (guidedRec.mixing){
      bullets.push("We’ll build a clean, balanced mix that translates on speakers and headphones.");
    } else {
      bullets.push("We’ll optimize loudness and tonal balance and check translation (stereo and mono).");
    }

    if (guidedState.trackType === "stems" && guidedRec.stemTier){
      if (guidedRec.stemTier === "25+"){
        bullets.push("Mixing from stems — over 24 stems (custom quote level).");
      } else {
        bullets.push(`Mixing from stems (${prettyStemTier(guidedRec.stemTier)}).`);
      }
    }

    if (guidedState.trackType === "vocals_beat"){
      bullets.push("Working from separate vocal file(s) plus instrumental/beat.");
    }

    if (guidedRec.vocalUpgrade){
      bullets.push("🎤 Vocal Upgrade added: full vocal chain from raw to studio-ready (tone, clarity, tuning, FX).");
    } else if (computeRecBase().suggestVocalUpgrade){
      bullets.push("Tip: Vocal Upgrade would give you a full vocal chain for more professional vocals.");
    }

    if (guidedRec.noiseReduction){
      bullets.push("✨ Noise cleanup added: project-level hiss / hum / room noise reduction.");
    } else if (computeRecBase().suggestNoise){
      bullets.push("Tip: Noise cleanup is recommended if you notice hiss, hum, or room noise.");
    }

    if (guidedState.addons.priority){
      bullets.push("⚡ Priority delivery selected (your project moves up in the queue).");
    }
    if (guidedState.addons.extraRevision){
      bullets.push("🔁 Extra revision selected for more flexibility.");
    }

    if (guidedState.goal === "release_ready" || guidedState.goal === "goal_unsure"){
      bullets.push("If you’re unsure: “Mixing” makes everything sit right together — “Mastering” makes it release-ready.");
    }

    if (guidedState.stems.tier === "25+"){
      bullets.push("Because this is a large session (25+ stems), I’ll follow up with a custom quote after you submit your files.");
    }

    guidedRec.bullets = bullets;

    const ul = $("recList");
    ul.innerHTML = "";
    guidedRec.bullets.forEach(t=>{
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });

    const w = $("recWarning");
    if (guidedRec.warning){
      w.textContent = guidedRec.warning;
      w.classList.remove("hidden");
    } else {
      w.classList.add("hidden");
    }

    updateNextState();
  }

  function prettyGoal(g){
    const map = {
      release_ready:"Make it sound finished / release-ready",
      improve_mix:"Improve the mix / balance",
      master_only:"Already mixed — polish it",
      vocals:"Make my vocals sound professional",
      problems:"Fix problems in the audio",
      goal_unsure:"I’m not sure (recommend for me)"
    };
    return map[g] || g || "—";
  }

  function prettyTrack(t){
    const map = {
      finished_song:"One finished song file",
      vocals_beat:"Separate vocals + instrumental",
      stems:"Stems – multiple files for different parts",
      raw_recording:"Raw recording",
      track_unsure:"Not sure"
    };
    return map[t] || t || "—";
  }

  function prettyIssue(i){
    const map = {
      noise:"Noise / hiss / hum",
      vocals_tone:"Vocals lack clarity / presence",
      harsh_muddy:"Harsh / muddy",
      vocals_balance:"Beat too loud vs vocals",
      none:"No specific issues"
    };
    return map[i] || i;
  }

  function getGuidedAddonsSummary(){
    const addons = [];
    if (guidedState.addons.noiseReduction) addons.push("Noise cleanup");
    if (guidedState.addons.vocalUpgrade) addons.push("Vocal Upgrade");
    if (guidedState.addons.priority) addons.push("Priority delivery");
    if (guidedState.addons.extraRevision) addons.push("Extra revision");
    return addons;
  }

  function buildGuidedSongDescriptor(){
    const parts = [];
    const { artistName, songTitle, genre, bpm, key, extraNotes } = metaState;

    const trackLabels = {
      finished_song: "Finished song file",
      vocals_beat: "Vocal + beat file",
      stems: "Separated stems",
      raw_recording: "Raw recording / demo",
      track_unsure: "Track (unsure what files yet)"
    };

    const trackType = guidedState.trackType;
    const trackLabel = trackLabels[trackType] || "Track";

    const hasMix = guidedRec.mixing;
    const hasMaster = guidedRec.mastering;
    const stemTierLabel = prettyStemTier(guidedRec.stemTier);

    // Services line
    if (hasMix && hasMaster) parts.push("Mix + Master");
    else if (hasMix) parts.push("Mix only");
    else if (hasMaster) parts.push("Master only");

    // File type line
    parts.push(trackLabel);

    // Stem tier text if we’re actually mixing
    if (hasMix && stemTierLabel){
      parts.push(`Stems: ${stemTierLabel}`);
    }

    // Issues (guidedState.issues is a Set)
    const issues = [];
    if (guidedState.issues.has("noise")) issues.push("Noise / hiss / hum");
    if (guidedState.issues.has("vocals_tone")) issues.push("Vocals lack clarity / presence");
    if (guidedState.issues.has("harsh_muddy")) issues.push("Harsh / muddy overall");
    if (guidedState.issues.has("vocals_balance")) issues.push("Beat too loud vs vocals");
    if (issues.length){
      parts.push(`Issues to fix: ${issues.join(", ")}`);
    }

    // Add-ons summary
    const addons = getGuidedAddonsSummary();
    if (addons.length){
      parts.push(`Add-ons: ${addons.join(", ")}`);
    }

    // Extra metadata
    if (genre) parts.push(`Genre: ${genre}`);
    if (bpm) parts.push(`BPM: ${bpm}`);
    if (key) parts.push(`Key: ${key}`);
    if (extraNotes) parts.push(`Notes: ${extraNotes}`);

    // ----- Cart metadata for this song -----
    let serviceType = null;
    if (hasMix && hasMaster) serviceType = "mixmaster";
    else if (hasMix) serviceType = "mix";
    else if (hasMaster) serviceType = "master";

    const stemTier = guidedRec.stemTier || null;

    const cartInfo = {
      serviceType,        // "mix" | "master" | "mixmaster" | null
      stemTier,           // "1-4" | "5-8" | "9-16" | "17-24" | "25+" | null
      addons: {
        noise: !!guidedState.addons.noiseReduction,
        vocalUpgrade: !!guidedState.addons.vocalUpgrade,
        priority: !!guidedState.addons.priority,
        extraRevision: !!guidedState.addons.extraRevision
      }
    };

    return {
      artistName: artistName || "Unknown Artist",
      songTitle: songTitle || "Untitled Song",
      summary: parts.join(" • "),
      cartInfo
    };
  }



  function renderReview(){
    const desc = buildGuidedSongDescriptor();
    $("reviewText").textContent = desc.summary;

    const totalSongs = guidedSongs.length + 1;
    $("projectCountNote").textContent = totalSongs === 1
      ? "This project currently includes 1 song."
      : `This project currently includes ${totalSongs} songs.`;
  }

  function updateMetaFromDetails(){
    const a = $("detailArtist");
    const s = $("detailSong");
    const g = $("detailGenre");
    const b = $("detailBpm");
    const k = $("detailKey");
    const n = $("detailNotes");

    if (a) metaState.artistName = a.value || "";
    if (s) metaState.songTitle = s.value || "";
    if (g) metaState.genre = g.value || "";
    if (b) metaState.bpm = b.value || "";
    if (k) metaState.key = k.value || "";
    if (n) metaState.extraNotes = n.value || "";

    updateNextState();
  }

  function bindDetailsInputs(){
    ["detailArtist","detailSong","detailGenre","detailBpm","detailKey","detailNotes"]
      .forEach(id=>{
        const el = $(id);
        if (!el) return;
        el.addEventListener("input", updateMetaFromDetails);
      });
  }

  function resetGuidedForNewSong(keepArtist){
    ["trackGrid","goalGrid","issuesGrid","tierGrid","addonsGrid"].forEach(gridId=>{
      qsa(`#${gridId} .pillCard`).forEach(x=>x.classList.remove("selected"));
    });
    $("trackCount").textContent = "0";
    $("goalCount").textContent = "0";
    $("issuesCount").textContent = "0";
    $("tierCount").textContent = "0";
    if ($("autoNoteNoise")) $("autoNoteNoise").textContent = "";
    if ($("autoNoteVocal")) $("autoNoteVocal").textContent = "";

    guidedState.trackType = null;
    guidedState.goal = null;
    guidedState.issues = new Set();
    guidedState.stems = { tier:null };
    guidedState.addons = {
      noiseReduction:false,
      vocalUpgrade:false,
      priority:false,
      extraRevision:false
    };
    guidedState.unsure = { track:false, goal:false };
    guidedState.addonsInitialized = false;
    addonAutoReasons.noise = null;
    addonAutoReasons.vocal = null;

    guidedRec.mixing = false;
    guidedRec.mastering = false;
    guidedRec.vocalUpgrade = false;
    guidedRec.noiseReduction = false;
    guidedRec.stemTier = null;
    guidedRec.headline = "";
    guidedRec.bullets = [];
    guidedRec.warning = null;

    const preservedArtist = keepArtist ? (metaState.artistName || "") : "";
    metaState.artistName = preservedArtist;
    metaState.songTitle = "";
    metaState.genre = "";
    metaState.bpm = "";
    metaState.key = "";
    metaState.extraNotes = "";

    if ($("detailArtist")) $("detailArtist").value = preservedArtist;
    ["detailSong","detailGenre","detailBpm","detailKey","detailNotes"].forEach(id=>{
      const el = $(id);
      if (el) el.value = "";
    });

    guidedSongIndex += 1;
    updateSongCounter();
    showStep(0);
  }

  function buildProjectSongsTextFromGuided(){
    const all = guidedSongs.slice();
    all.push(buildGuidedSongDescriptor());

    const lines = [];
    all.forEach((song, idx)=>{
      lines.push(`Song ${idx+1}:`);
      lines.push(`- Title: ${song.songTitle}`);
      lines.push(`- Artist: ${song.artistName}`);
      lines.push(`- Details: ${song.summary}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  function buildGuidedTallyURL(){
    const projectSongsText = buildProjectSongsTextFromGuided();
    const allCount = guidedSongs.length + 1;
    const isMulti = allCount > 1;

    const servicesLabel = isMulti
      ? "Multiple songs – see projectSongs"
      : buildServicesLabel(guidedRec.mixing, guidedRec.mastering);

    const addonsArr = buildAddonsLabelFromGuided();
    const addonsLabel = isMulti
      ? "Multiple songs – see projectSongs"
      : (Array.isArray(addonsArr) && addonsArr.length ? addonsArr.join(", ") : "");


    const stemCountLabel = isMulti
      ? "Multiple songs – see projectSongs"
      : (
          guidedState.trackType === "stems" && guidedState.stems.tier
            ? prettyStemTier(guidedState.stems.tier)
            : ""
        );

    const topArtist = metaState.artistName || "Unknown artist";
    const topSong = isMulti ? "(multiple songs)" : (metaState.songTitle || "Untitled");

    const params = new URLSearchParams({
      artistName: topArtist,
      songTitle: topSong,
      genre: metaState.genre,
      bpm: metaState.bpm,
      key: metaState.key,
      services: servicesLabel,
      addons: addonsLabel,
      stemCount: stemCountLabel,
      extraNotes: metaState.extraNotes,
      projectSongs: projectSongsText
    });

    return `${TALLY_BASE_URL}?${params.toString()}`;
  }

  function guidedInit(){
    bindSingle("trackGrid","trackType","trackCount","track","data-track");
    bindSingle("goalGrid","goal","goalCount","goal","data-goal");
    bindIssues();
    bindStemsCount();
    bindAddons();
    bindDetailsInputs();

    $("btnBack").addEventListener("click", ()=>{
      const s = steps();
      const id = s[stepIndex].id;
      if (stepIndex === 0){
        showMode("entry");
        return;
      }
      if (id === "stepAddons" && !shouldNeedStemsFlow()){
        showStep(stepIndex - 3);
      } else {
        showStep(stepIndex - 1);
      }
    });

    $("btnNext").addEventListener("click", ()=>{
      const s = steps();
      const id = s[stepIndex].id;

      if (!canGoNext()) return;

      if (id === "stepIssues"){
        if (shouldNeedStemsFlow()){
          showStep(stepIndex + 1);
        } else {
          showStep(stepIndex + 3);
        }
        return;
      }

     if (id === "stepReview"){
     // Final guided step: build cart + open Tally + go to checkout
     handlePortalCheckout("guided");
     return;
   }


      showStep(stepIndex + 1);
    });

    $("btnAddSongGuided").addEventListener("click", ()=>{
      if (!metaState.artistName || !metaState.songTitle){
        alert("Please fill in Artist name and Song title before adding another song.");
        return;
      }
      const desc = buildGuidedSongDescriptor();
      guidedSongs.push(desc);
      resetGuidedForNewSong(true);
    });

    updateSongCounter();
    showStep(0);
  }

  /* ========= MANUAL MODE ========= */

  const manualState = {
  services: new Set(),
  fileType: "",
  stemTier: "",
  addons: {
    noise:false,
    vocal:false,
    priority:false,
    revision:false
  },
  issues: {
    noise:false,
    tone:false,
    dynamics:false,
    clarity:false,
    other:false,
    otherText:""
  }
};


  function updateManualStemVisibility(){
    const ft = manualState.fileType;
    const needsStems = (ft === "stems" || ft === "vocals_beat");
    $("manualStemTitle").style.display = needsStems ? "block" : "none";
    $("manualStemRow").style.display = needsStems ? "block" : "none";
  }

  function updateManualProjectCountNote(){
    const total = manualSongs.length + 1;
    const el = $("manualProjectCountNote");
    if (!el) return;
    el.textContent = total === 1
      ? "This project currently includes 1 song."
      : `This project currently includes ${total} songs.`;
  }

  function updateManualSongList(){
    const container = $("manualSongList");
    if (!container) return;

    const all = manualSongs.slice();
    all.push(buildManualSongDescriptor());

    if (!all.length){
      container.textContent = "No songs added yet.";
      return;
    }

    const lines = all.map((song, idx)=> `${idx+1}. ${song.artistName} – ${song.songTitle}`);
    container.textContent = "Songs in this project:\n" + lines.join("\n");
  }

  function updateManualSummary(){
    const parts = [];

    if (metaState.artistName || metaState.songTitle){
      parts.push(
        "Project: " +
        (metaState.artistName || "Unknown artist") +
        " – " +
        (metaState.songTitle || "Untitled")
      );
    }

    if (manualState.services.size){
      const list = [];
      const hasMix = manualState.services.has("mix");
      const hasMaster = manualState.services.has("master");
      const hasMixmaster = manualState.services.has("mixmaster");

      if (hasMixmaster || (hasMix && hasMaster)){
        list.push("Mix + Master");
      } else {
        if (hasMix) list.push("Mix");
        if (hasMaster) list.push("Master");
      }
      parts.push("Services: " + list.join(", "));
    } else {
      parts.push("Services: (none selected yet)");
    }

    if (manualState.fileType){
      parts.push("Files: " + prettyTrack(manualState.fileType));
    } else {
      parts.push("Files: (not set)");
    }

    if (manualState.stemTier && (manualState.fileType==="stems" || manualState.fileType==="vocals_beat")){
      parts.push("Stem range: " + prettyStemTier(manualState.stemTier));
    }

    const addonList = buildAddonsLabelFromManual();
    if (addonList.length){
      parts.push("Add-ons: " + addonList.join(", "));
    } else {
      parts.push("Add-ons: (none)");
    }

    if (manualState.stemTier === "25+"){
      parts.push("Note: 25+ stems will require a custom quote after you upload your files.");
    }

    $("manualSummary").textContent = parts.join(" • ");
    updateManualProjectCountNote();
    updateManualSongList();
    updateManualSongNumber();
  }

  function updateMetaFromManualDetails(){
    const a = $("manualArtist");
    const s = $("manualSong");
    const g = $("manualGenre");
    const b = $("manualBpm");
    const k = $("manualKey");
    const n = $("manualNotes");

    if (a) metaState.artistName = a.value || "";
    if (s) metaState.songTitle = s.value || "";
    if (g) metaState.genre = g.value || "";
    if (b) metaState.bpm = b.value || "";
    if (k) metaState.key = k.value || "";
    if (n) metaState.extraNotes = n.value || "";

    updateManualSummary();
  }

// ===== Manual-mode helpers =====
function getManualAddonsSummary(){
  const addons = [];
  if (manualState.addons.noise) addons.push("Noise cleanup");
  if (manualState.addons.vocal) addons.push("Vocal Upgrade");
  if (manualState.addons.priority) addons.push("Priority delivery");
  if (manualState.addons.revision) addons.push("Extra revision");
  return addons;
}

  function buildManualSongDescriptor(){
  const { artistName, songTitle, genre, bpm, key, extraNotes } = metaState;
  const parts = [];

  const hasMix = manualState.services.has("mix");
  const hasMaster = manualState.services.has("master");
  const services = [];
  if (hasMix) services.push("Mix");
  if (hasMaster) services.push("Master");

  if (services.length === 2) parts.push("Mix + Master");
  else if (services.length === 1) parts.push(services[0]);

  const prettyFileType = {
    finished_song: "Finished song file",
    vocals_beat: "Vocal + beat file",
    stems: "Separated stems",
    raw_recording: "Raw recording / demo"
  };

  const fileTypeLabel = prettyFileType[manualState.fileType];
  if (fileTypeLabel) parts.push(fileTypeLabel);

  if (manualState.fileType === "stems" && manualState.stemTier){
    parts.push(`Stems: ${manualState.stemTier} stems`);
  }

  const issues = [];
  if (manualState.issues.noise) issues.push("Noise / hum");
  if (manualState.issues.tone) issues.push("Tone / harshness");
  if (manualState.issues.dynamics) issues.push("Dynamics / punch");
  if (manualState.issues.clarity) issues.push("Clarity / mud");
  if (manualState.issues.other && manualState.issues.otherText){
    issues.push(manualState.issues.otherText);
  }
  if (issues.length){
    parts.push(`Issues to fix: ${issues.join(", ")}`);
  }

  const addonsList = getManualAddonsSummary();
  if (addonsList.length){
    parts.push(`Add-ons: ${addonsList.join(", ")}`);
  }

  if (genre) parts.push(`Genre: ${genre}`);
  if (bpm) parts.push(`BPM: ${bpm}`);
  if (key) parts.push(`Key: ${key}`);
  if (extraNotes) parts.push(`Notes: ${extraNotes}`);

  // ----- Cart metadata for this song -----
  let serviceType = null;
  if (hasMix && hasMaster) serviceType = "mixmaster";
  else if (hasMix) serviceType = "mix";
  else if (hasMaster) serviceType = "master";

  let stemTier = null;
  if (manualState.fileType === "stems" && manualState.stemTier){
    stemTier = manualState.stemTier; // "1-4", "5-8", "9-16", "17-24", "25+"
  }

  const cartInfo = {
    serviceType,
    stemTier,
    addons: {
      noise: !!manualState.addons.noise,
      vocalUpgrade: !!manualState.addons.vocal,
      priority: !!manualState.addons.priority,
      extraRevision: !!manualState.addons.revision
    }
  };

  return {
    artistName: artistName || "Unknown Artist",
    songTitle: songTitle || "Untitled Song",
    summary: parts.join(" • "),
    cartInfo
  };
}


  function buildManualProjectSongsText(){
    const all = manualSongs.slice();
    all.push(buildManualSongDescriptor());

    const lines = [];
    all.forEach((song, idx)=>{
      lines.push(`Song ${idx+1}:`);
      lines.push(`- Title: ${song.songTitle}`);
      lines.push(`- Artist: ${song.artistName}`);
      lines.push(`- Details: ${song.summary}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  function buildManualTallyURL(){
    const all = manualSongs.slice();
    all.push(buildManualSongDescriptor());
    const total = all.length;
    const isMulti = total > 1;

    const servicesLabel = (()=>{
      if (isMulti) return "Multiple songs – see projectSongs";
      const hasMix = manualState.services.has("mix");
      const hasMaster = manualState.services.has("master");
      const hasMixmaster = manualState.services.has("mixmaster");
      const mixing = hasMix || hasMixmaster;
      const mastering = hasMaster || hasMixmaster;
      return buildServicesLabel(mixing, mastering);
    })();

    const addonsArr = buildAddonsLabelFromManual();
    const addonsLabel = isMulti
      ? "Multiple songs – see projectSongs"
      : (Array.isArray(addonsArr) && addonsArr.length ? addonsArr.join(", ") : "");


    const stemCountLabel = isMulti
      ? "Multiple songs – see projectSongs"
      : (
          (manualState.fileType === "stems" || manualState.fileType === "vocals_beat") && manualState.stemTier
            ? prettyStemTier(manualState.stemTier)
            : ""
        );

    const topArtist = metaState.artistName || "Unknown artist";
    const topSong = isMulti ? "(multiple songs)" : (metaState.songTitle || "Untitled");
    const projectSongsText = buildManualProjectSongsText();

    const params = new URLSearchParams({
      artistName: topArtist,
      songTitle: topSong,
      genre: metaState.genre,
      bpm: metaState.bpm,
      key: metaState.key,
      services: servicesLabel,
      addons: addonsLabel,
      stemCount: stemCountLabel,
      extraNotes: metaState.extraNotes,
      projectSongs: projectSongsText
    });

    return `${TALLY_BASE_URL}?${params.toString()}`;
  }

  function resetManualState(keepArtist){
    manualState.services.clear();
    manualState.fileType = "";
    manualState.stemTier = "";
    manualState.addons = {noise:false,vocal:false,priority:false,revision:false};

    qsa("#manualServices .manualPill").forEach(x=>x.classList.remove("selected"));
    $("manualFileType").value = "";
    $("manualStemTier").value = "";
    $("manualNoise").checked = false;
    $("manualVocal").checked = false;
    $("manualPriority").checked = false;
    $("manualRevision").checked = false;

    const preservedArtist = keepArtist ? (metaState.artistName || "") : "";
    metaState.artistName = preservedArtist;
    metaState.songTitle = "";
    metaState.genre = "";
    metaState.bpm = "";
    metaState.key = "";
    metaState.extraNotes = "";

    if ($("manualArtist")) $("manualArtist").value = preservedArtist;
    ["manualSong","manualGenre","manualBpm","manualKey","manualNotes"].forEach(id=>{
      const el = $(id);
      if (el) el.value = "";
    });

    updateManualStemVisibility();
    updateManualSummary();
  }

  function guidedInitOnce(){
    guidedInit();
  }

  function manualInit(){
    ["manualArtist","manualSong","manualGenre","manualBpm","manualKey","manualNotes"]
      .forEach(id=>{
        const el = $(id);
        if (!el) return;
        el.addEventListener("input", updateMetaFromManualDetails);
      });

    qsa("#manualServices .manualPill").forEach(el=>{
      el.addEventListener("click", ()=>{
        const key = el.getAttribute("data-service");
        const mixmasterPill = qsa("#manualServices .manualPill").find(x=>x.getAttribute("data-service")==="mixmaster");

        if (key === "mixmaster"){
          manualState.services.clear();
          manualState.services.add("mix");
          manualState.services.add("master");
          qsa("#manualServices .manualPill").forEach(x=>x.classList.remove("selected"));
          el.classList.add("selected");
        } else {
          if (mixmasterPill) mixmasterPill.classList.remove("selected");

          const isOn = !el.classList.contains("selected");
          el.classList.toggle("selected", isOn);
          if (isOn) manualState.services.add(key);
          else manualState.services.delete(key);
        }
        updateManualSummary();
      });
    });

    $("manualFileType").addEventListener("change", e=>{
      manualState.fileType = e.target.value;
      updateManualStemVisibility();
      updateManualSummary();
    });

    $("manualStemTier").addEventListener("change", e=>{
      manualState.stemTier = e.target.value;
      updateManualSummary();
    });

    $("manualNoise").addEventListener("change", e=>{
      manualState.addons.noise = e.target.checked;
      updateManualSummary();
    });
    $("manualVocal").addEventListener("change", e=>{
      manualState.addons.vocal = e.target.checked;
      updateManualSummary();
    });
    $("manualPriority").addEventListener("change", e=>{
      manualState.addons.priority = e.target.checked;
      updateManualSummary();
    });
    $("manualRevision").addEventListener("change", e=>{
      manualState.addons.revision = e.target.checked;
      updateManualSummary();
    });

    $("manualReset").addEventListener("click", ()=>{
      manualSongs.length = 0;
      resetManualState(false);
      updateManualSongNumber();
    });

    $("manualAddSong").addEventListener("click", ()=>{
      if (!metaState.artistName || !metaState.songTitle){
        alert("Please fill in Artist name and Song title before adding another song.");
        return;
      }
      const desc = buildManualSongDescriptor();
      manualSongs.push(desc);
      resetManualState(true);
      updateManualSongNumber();
    });

    $("manualCheckout").addEventListener("click", ()=>{
  if (!metaState.artistName || !metaState.songTitle){
    alert("Please fill in Artist name and Song title before continuing.");
    return;
  }
  // Manual mode: build cart + open Tally + go to checkout
  handlePortalCheckout("manual");
});


    updateManualStemVisibility();
    updateManualSummary();
    updateManualSongNumber();
  }
// ===== FOURTHWALL CART HELPERS =====

function getAllSongsForCart(mode){
  if (mode === "guided"){
    const songs = guidedSongs.slice();
    songs.push(buildGuidedSongDescriptor());
    return songs;
  }
  if (mode === "manual"){
    const songs = manualSongs.slice();
    songs.push(buildManualSongDescriptor());
    return songs;
  }
  return [];
}

function mapServiceToVariantId(serviceType, stemTier){
  if (serviceType === "master"){
    return FW_VARIANTS.masterOnly;
  }

  if (!stemTier){
    return null;
  }

  const tier = stemTier; // "1-4", "5-8", "9-16", "17-24", "25+"

  if (tier === "25+"){
    // We’ll handle this as a custom project instead of a normal SKU
    return null;
  }

  if (serviceType === "mix"){
    if (tier === "1-4")  return FW_VARIANTS.mixOnly_1_4;
    if (tier === "5-8")  return FW_VARIANTS.mixOnly_5_8;
    if (tier === "9-16") return FW_VARIANTS.mixOnly_9_16;
    if (tier === "17-24")return FW_VARIANTS.mixOnly_17_24;
  }

  if (serviceType === "mixmaster"){
    if (tier === "1-4")  return FW_VARIANTS.mixMaster_1_4;
    if (tier === "5-8")  return FW_VARIANTS.mixMaster_5_8;
    if (tier === "9-16") return FW_VARIANTS.mixMaster_9_16;
    if (tier === "17-24")return FW_VARIANTS.mixMaster_17_24;
  }

  return null;
}

function addCartItem(store, key, variantId, quantity){
  if (!store[key]){
    store[key] = { variantId, quantity: 0 };
  }
  store[key].quantity += quantity;
}

function buildCartLineItemsFromSongs(songs){
  const itemsByKey = {};
  let hasPriority = false;
  let needsCustomQuote = false;

  for (const song of songs){
    const info = song.cartInfo;
    if (!info || !info.serviceType) continue;

    // Custom project trigger (25+ stems)
    if (info.stemTier === "25+"){
      needsCustomQuote = true;
      continue;
    }

    const baseVariantId = mapServiceToVariantId(info.serviceType, info.stemTier);
    if (baseVariantId){
      const baseKey = `${info.serviceType}_${info.stemTier || "noTier"}`;
      addCartItem(itemsByKey, baseKey, baseVariantId, 1);
    }

    // Per-track add-ons
    if (info.addons.noise){
      addCartItem(itemsByKey, "noiseCleanup", FW_VARIANTS.noiseCleanup, 1);
    }
    if (info.addons.vocalUpgrade){
      addCartItem(itemsByKey, "vocalUpgrade", FW_VARIANTS.vocalUpgrade, 1);
    }
    if (info.addons.extraRevision){
      addCartItem(itemsByKey, "extraRevision", FW_VARIANTS.extraRevision, 1);
    }

    // Priority is per-project (one per portal session)
    if (info.addons.priority){
      hasPriority = true;
    }
  }

  if (hasPriority){
    addCartItem(itemsByKey, "priorityDelivery", FW_VARIANTS.priorityDelivery, 1);
  }

  if (needsCustomQuote){
    addCartItem(itemsByKey, "customProject", FW_VARIANTS.customProject, 1);
  }

  return Object.values(itemsByKey);
}

async function createFourthwallCart(lineItems){
  const response = await fetch(`${FW_API_BASE}/carts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${FW_STOREFRONT_TOKEN}`
    },
    body: JSON.stringify({ items: lineItems })
  });

  let data;
  try {
    data = await response.json();
  } catch (e){
    console.error("Error parsing Fourthwall response:", e);
  }

  if (!response.ok){
    console.error("Fourthwall error response:", data);
    throw new Error(data && data.title ? data.title : "Failed to create cart");
  }

  return data;
}

async function handlePortalCheckout(mode){
  // 1) Build the list of songs for this mode
  const songs = getAllSongsForCart(mode);
  if (!songs.length){
    alert("Please add at least one song before continuing.");
    return;
  }

  // 2) Build cart line items
  const lineItems = buildCartLineItemsFromSongs(songs);
  if (!lineItems.length){
    alert("Nothing to add to cart based on your selections. Please double-check your services.");
    return;
  }

console.log("Fourthwall line items:", lineItems);

    // 3) Open Tally upload form in a new tab (same behavior as before)
  let tallyURL = mode === "guided" ? buildGuidedTallyURL() : buildManualTallyURL();

  // Guard: if a builder misbehaves, fall back to base form instead of blank tab
  if (!tallyURL || typeof tallyURL !== "string"){
    console.error("Tally URL builder returned an invalid value:", tallyURL);
    tallyURL = TALLY_BASE_URL;
  }

  console.log("Opening Tally URL:", tallyURL);
    // Safari-safe popup pattern
  const newTab = window.open("", "_blank");

  if (newTab && tallyURL){
    // Navigate the newly opened tab explicitly (works better in Safari)
    newTab.location.href = tallyURL;
  } else if (tallyURL){
    // Fallback if popups are blocked: at least navigate this tab
    window.location.href = tallyURL;
  }



  // 3.5) If we're running locally (file preview / localhost), skip the API cart step.
  const isLocalEnv =
    location.protocol === "file:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (isLocalEnv){
    console.warn("Skipping Fourthwall cart creation in local preview.");
    alert(
      "Your upload form is open in a new tab.\n\n" +
      "Because this is a local preview, the store cart can't be created automatically. " +
      "On the real site, this step will add everything to your cart for you."
    );
    return;
  }

  // 4) Create cart and send user to the store cart page
  try {
    const cart = await createFourthwallCart(lineItems);

    if (!cart || !cart.id){
      console.error("Cart created but no id found:", cart);
      alert(
        "Cart creation succeeded but no checkout link was returned.\n\n" +
        "Please add the services manually in the store."
      );
      return;
    }

    const checkoutUrl =
      `https://${FW_CHECKOUT_DOMAIN}/cart/?cartCurrency=USD&cartId=${encodeURIComponent(cart.id)}`;

    window.location.href = checkoutUrl;
  } catch (err){
    console.error("Error creating Fourthwall cart:", err);
    alert(
      "There was a problem creating your cart automatically.\n\n" +
      "Your upload form is already open in a new tab — " +
      "please add the services manually on the store."
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // If the portal markup isn't on this page, do nothing.
  if (!document.getElementById("entryMode")) return;

  guidedInitOnce();
  manualInit();
  showMode("entry");
  });
