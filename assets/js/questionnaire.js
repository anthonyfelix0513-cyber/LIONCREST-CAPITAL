/* ==========================================================================
   LIONCREST CAPITAL — Moteur du parcours d'analyse patrimoniale (v2)
   Organisation :
     1. ETAT + SAUVEGARDE AUTOMATIQUE
     2. CONFIGURATION DES ETAPES
     3. MOTEUR DE RENDU GENERIQUE (champs standards + répétables génériques)
     4. NAVIGATION / VALIDATION
     5. ETAPE SPECIALE "PATRIMOINE FINANCIER" (supports fixes + répétables)
     6. ECRAN DE FIN + EXPORT PDF (dossier client)
   ========================================================================== */

(function(){
"use strict";

const STORAGE_KEY = "lioncrest_analyse_v1";

/* ==========================================================================
   1. ETAT
   ========================================================================== */
function freshPersonne(){
  return {
    nom:"", prenom:"", dateNaissance:"", lieuNaissance:"", nationalite:"",
    profession:"", employeur:"", anciennete:"", typeContrat:"", regimeRetraite:"", telephone:"", email:"",
    revenuSalaries:"", dividendes:"", revenusFonciers:"", bicBnc:"", autresRevenus:"",
    chargesCredits:"", chargesImpots:"", chargesIfi:"", chargesCopro:"", chargesLoyer:"", trainDeVie:"",
  };
}

function freshState(){
  return {
    // Etape 1 — état civil (personne A — celle qui remplit le formulaire)
    nom:"", prenom:"", dateNaissance:"", lieuNaissance:"", nationalite:"",
    profession:"", employeur:"", anciennete:"", typeContrat:"", regimeRetraite:"",
    adresse:"", telephone:"", email:"",
    situationFamiliale:"", regimeMatrimonial:"",
    // Seconde et troisième personnes (optionnelles) — mêmes champs, préfixés pb_ / pc_ dans les formulaires
    hasPersonneB:false,
    personneB:freshPersonne(),
    hasPersonneC:false,
    personneC:freshPersonne(),
    // Etape 2 — revenus et charges (personne A)
    revenuSalaries:"", dividendes:"", revenusFonciers:"", bicBnc:"", autresRevenus:"",
    chargesCredits:"", chargesImpots:"", chargesIfi:"", chargesCopro:"", chargesLoyer:"", trainDeVie:"",
    // Etape 3 — crédits (répétable)
    credits:[],
    // Etape 4 — immobilier (répétable)
    biensImmo:[],
    // Etape 5 — financier : supports fixes (banque + valeur + propriétaire) + plusieurs répétables
    epargne:{
      livretA:{banque:"",valeur:"",proprietaire:""}, ldds:{banque:"",valeur:"",proprietaire:""},
      lep:{banque:"",valeur:"",proprietaire:""},
      pea:{banque:"",valeur:"",proprietaire:"",anneeOuverture:""},
      compteTitres:{banque:"",valeur:"",proprietaire:""},
    },
    comptesCourants:[],
    comptesTerme:[],
    assurancesVie:[],
    pers:[],
    epargneSalariale:[],
    // Etape 6 — actifs professionnels (répétable)
    actifsPro:[],
    // Etape 7 — prévoyance
    prevoyanceContrats:[], prevoyanceDocuments:[],
    // Etape 8 — objectifs
    objectifs:[],
    // Etape 9 — profil investisseur
    appetence:"", horizon:"", experience:"",
    // Etape 10 — commentaire libre
    commentaireLibre:"",
  };
}
let state = freshState();
let idSeq = { credits:0, biensImmo:0, actifsPro:0, comptesCourants:0, comptesTerme:0, assurancesVie:0, pers:0, epargneSalariale:0 };

function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({state, currentStep})); }catch(e){ /* stockage indisponible — on continue sans sauvegarde */ }
}
function loadSavedState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function clearSavedState(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
}

/* --- Lecture / écriture unifiée : un champ "pb_xxx" cible personneB, "pc_xxx" cible personneC --- */
function getFieldValue(id){
  if(id.indexOf("pb_")===0) return state.personneB[id.slice(3)];
  if(id.indexOf("pc_")===0) return state.personneC[id.slice(3)];
  return state[id];
}
function setFieldValue(id, value){
  if(id.indexOf("pb_")===0){ state.personneB[id.slice(3)] = value; }
  else if(id.indexOf("pc_")===0){ state.personneC[id.slice(3)] = value; }
  else{ state[id] = value; }
}
/* --- Options de propriétaire, générées dynamiquement selon les personnes ajoutées --- */
function proprietaireOptions(){
  const nomA = (state.prenom || "").trim() || "Personne A";
  const nomB = (state.personneB.prenom || "").trim() || "Personne B";
  const options = [
    {v:"A", l:nomA},
    {v:"B", l:nomB},
  ];
  if(state.hasPersonneC){
    const nomC = (state.personneC.prenom || "").trim() || "Personne C";
    options.push({v:"C", l:nomC});
  }
  options.push({v:"commun", l:"Bien / compte commun"});
  return options;
}

/* ==========================================================================
   2. CONFIGURATION DES ETAPES
   ========================================================================== */
const SITUATION_OPTIONS = [
  {v:"celibataire", l:"Célibataire"}, {v:"marie", l:"Marié(e)"}, {v:"pacse", l:"Pacsé(e)"},
  {v:"divorce", l:"Divorcé(e)"}, {v:"veuf", l:"Veuf / veuve"}, {v:"concubinage", l:"Concubinage"},
];
const REGIME_OPTIONS = [
  {v:"communaute_legale", l:"Communauté légale"}, {v:"separation_biens", l:"Séparation de biens"},
  {v:"participation_acquets", l:"Participation aux acquêts"}, {v:"communaute_universelle", l:"Communauté universelle"},
];
const BANKS = [
  {v:"bnp_paribas", l:"BNP Paribas"}, {v:"societe_generale", l:"Société Générale"},
  {v:"credit_agricole", l:"Crédit Agricole"}, {v:"credit_mutuel", l:"Crédit Mutuel"},
  {v:"lcl", l:"LCL"}, {v:"cic", l:"CIC"}, {v:"banque_populaire", l:"Banque Populaire"},
  {v:"caisse_epargne", l:"Caisse d'Épargne"}, {v:"banque_postale", l:"La Banque Postale"},
  {v:"hsbc", l:"HSBC Continental Europe"}, {v:"banque_palatine", l:"Banque Palatine"},
  {v:"neuflize_obc", l:"Neuflize OBC"}, {v:"milleis", l:"Milleis Banque"}, {v:"barclays", l:"Barclays"},
  {v:"boursorama", l:"Boursorama Banque"}, {v:"hello_bank", l:"Hello bank!"}, {v:"fortuneo", l:"Fortuneo"},
  {v:"bforbank", l:"BforBank"}, {v:"ing", l:"ING France"}, {v:"monabanq", l:"Monabanq"},
  {v:"revolut", l:"Revolut"}, {v:"n26", l:"N26"}, {v:"autre", l:"Autre banque"},
];
const CLAUSE_BENEFICIAIRE_OPTIONS = [
  {v:"conjoint", l:"Clause conjoint"}, {v:"enfants", l:"Clause enfants"}, {v:"sur_mesure", l:"Clause sur-mesure"},
];

const STEPS = [
  {
    id:"etat-civil", title:"État civil et situation personnelle",
    subtitle:"Ces informations nous permettent de vous situer précisément dans votre parcours de vie et professionnel.",
    fields:[
      {id:"nom", label:"Nom", type:"text", required:true},
      {id:"prenom", label:"Prénom", type:"text", required:true},
      {id:"dateNaissance", label:"Date de naissance", type:"date", required:true},
      {id:"lieuNaissance", label:"Lieu de naissance", type:"text", required:false},
      {id:"nationalite", label:"Nationalité", type:"text", required:false},
      {id:"profession", label:"Profession", type:"text", required:true},
      {id:"employeur", label:"Employeur", type:"text", required:false},
      {id:"anciennete", label:"Ancienneté", type:"text", required:false, placeholder:"Ex. 6 ans"},
      {id:"typeContrat", label:"Type de contrat", type:"select", required:false, options:[
        {v:"cdi", l:"CDI"},{v:"cdd", l:"CDD"},{v:"tns", l:"TNS"},{v:"fonctionnaire", l:"Fonctionnaire"},{v:"autre", l:"Autre"},
      ]},
      {id:"regimeRetraite", label:"Régime de retraite", type:"text", required:false},
      {id:"adresse", label:"Adresse", type:"text", required:false},
      {id:"telephone", label:"Téléphone", type:"tel", required:true},
      {id:"email", label:"E-mail", type:"email", required:true, help:"La confirmation de votre analyse y sera envoyée."},
      {id:"situationFamiliale", label:"Situation familiale", type:"select", required:true, options:SITUATION_OPTIONS},
      {id:"regimeMatrimonial", label:"Régime matrimonial", type:"select", required:true, condition:s=>s.situationFamiliale==="marie", options:REGIME_OPTIONS},
    ]
  },
  {
    id:"revenus-charges", title:"Revenus et charges",
    subtitle:"Indiquez vos montants annuels. Laissez à 0 les rubriques qui ne vous concernent pas.",
    groups:[
      { title:"Revenus annuels", fields:[
        {id:"revenuSalaries", label:"Revenus salariés (€)", type:"number", min:0},
        {id:"dividendes", label:"Dividendes (€)", type:"number", min:0},
        {id:"revenusFonciers", label:"Revenus fonciers (€)", type:"number", min:0},
        {id:"bicBnc", label:"BIC / BNC (€)", type:"number", min:0},
        {id:"autresRevenus", label:"Autres revenus (€)", type:"number", min:0},
      ]},
      { title:"Charges annuelles", fields:[
        {id:"chargesLoyer", label:"Loyer (€)", type:"number", min:0},
        {id:"chargesCredits", label:"Crédits (€)", type:"number", min:0},
        {id:"chargesImpots", label:"Impôts (€)", type:"number", min:0},
        {id:"chargesIfi", label:"IFI (€)", type:"number", min:0},
        {id:"chargesCopro", label:"Charges de copropriété (€)", type:"number", min:0},
        {id:"trainDeVie", label:"Train de vie annuel (€)", type:"number", min:0},
      ]},
    ]
  },
  {
    id:"credits", title:"Crédits en cours", repeaterKey:"credits", itemLabel:"Crédit", addLabel:"un crédit",
    subtitle:"Ajoutez chaque crédit en cours de remboursement.",
    itemFields:[
      {key:"type", label:"Type de crédit", type:"select", options:[
        {v:"residence_principale", l:"Crédit résidence principale"},{v:"locatif", l:"Crédit locatif"},
        {v:"auto", l:"Crédit automobile"},{v:"conso", l:"Crédit consommation"},{v:"autre", l:"Autre"},
      ]},
      {key:"banque", label:"Banque", type:"select", options:BANKS},
      {key:"mensualite", label:"Mensualité (€)", type:"number", min:0},
      {key:"capitalRestant", label:"Capital restant dû (€)", type:"number", min:0},
      {key:"dateFin", label:"Date de fin", type:"date"},
    ]
  },
  {
    id:"immobilier", title:"Patrimoine immobilier", repeaterKey:"biensImmo", itemLabel:"Bien", addLabel:"un bien",
    subtitle:"Ajoutez chaque bien détenu, seul, en indivision, en SCI ou en SCPI.",
    itemFields:[
      {key:"type", label:"Type de bien", type:"select", options:[
        {v:"residence_principale", l:"Résidence principale"},{v:"residence_secondaire", l:"Résidence secondaire"},
        {v:"appartement_locatif", l:"Appartement locatif"},{v:"maison_locative", l:"Maison locative"},
        {v:"sci", l:"SCI"},{v:"scpi", l:"SCPI"},{v:"terrain", l:"Terrain"},{v:"parking", l:"Parking"},{v:"autre", l:"Autre"},
      ]},
      {key:"proprietaire", label:"Propriétaire", type:"select", condition:s=>s.hasPersonneB, options:proprietaireOptions, highlight:true},
      {key:"adresse", label:"Adresse", type:"text"},
      {key:"valeur", label:"Valeur estimée (€)", type:"number", min:0},
      {key:"capitalRestant", label:"Capital restant dû (€)", type:"number", min:0},
      {key:"revenusLocatifs", label:"Revenus locatifs annuels (€)", type:"number", min:0},
      {key:"dpe", label:"DPE", type:"select", options:[
        {v:"a", l:"A"},{v:"b", l:"B"},{v:"c", l:"C"},{v:"d", l:"D"},{v:"e", l:"E"},{v:"f", l:"F"},{v:"g", l:"G"},{v:"ns", l:"Non soumis / inconnu"},
      ]},
    ]
  },
  { id:"financier", title:"Patrimoine financier", subtitle:"Renseignez la valeur actuelle de chaque support détenu. Laissez à 0 si vous n'en détenez pas.", financier:true },
  {
    id:"actifs-pro", title:"Actifs professionnels", repeaterKey:"actifsPro", itemLabel:"Société", addLabel:"une société",
    subtitle:"Si vous détenez une ou plusieurs sociétés, ajoutez-les ici. Sinon, passez à l'étape suivante.",
    itemFields:[
      {key:"societe", label:"Nom de la société", type:"text"},
      {key:"formeJuridique", label:"Forme juridique", type:"select", options:[
        {v:"sas", l:"SAS / SASU"},{v:"sarl", l:"SARL / EURL"},{v:"sci", l:"SCI"},{v:"sa", l:"SA"},{v:"autre", l:"Autre"},
      ]},
      {key:"pourcentageDetention", label:"Pourcentage de détention (%)", type:"number", min:0},
      {key:"valeurEstimee", label:"Valeur estimée (€)", type:"number", min:0},
      {key:"chiffreAffaires", label:"Chiffre d'affaires (€)", type:"number", min:0},
      {key:"tresorerie", label:"Trésorerie disponible (€)", type:"number", min:0},
      {key:"projetCession", label:"Projet de cession", type:"select", options:[
        {v:"oui", l:"Oui"},{v:"non", l:"Non"},{v:"a_etudier", l:"À étudier"},
      ]},
    ]
  },
  {
    id:"prevoyance", title:"Prévoyance", subtitle:"Sélectionnez les contrats et documents dont vous disposez déjà.",
    fields:[
      {id:"prevoyanceContrats", label:"Contrats de prévoyance", type:"checkbox-group", options:[
        {v:"deces", l:"Décès"},{v:"invalidite", l:"Invalidité"},{v:"homme_cle", l:"Homme clé"},{v:"mutuelle", l:"Mutuelle"},{v:"protection_conjoint", l:"Protection du conjoint"},
      ]},
      {id:"prevoyanceDocuments", label:"Documents juridiques existants", type:"checkbox-group", options:[
        {v:"testament", l:"Testament"},{v:"mandat_protection_future", l:"Mandat de protection future"},
        {v:"donation_dernier_vivant", l:"Donation au dernier vivant"},{v:"contrat_mariage", l:"Contrat de mariage"},
      ]},
    ]
  },
  {
    id:"objectifs", title:"Objectifs patrimoniaux", subtitle:"Sélectionnez tout ce qui correspond à votre situation.",
    fields:[
      {id:"objectifs", label:"Vos objectifs", type:"checkbox-group", required:true, options:[
        {v:"developper", l:"Développer mon patrimoine"},{v:"retraite", l:"Préparer ma retraite"},
        {v:"reduire_fiscalite", l:"Réduire ma fiscalité"},{v:"acheter_immobilier", l:"Acheter un bien immobilier"},
        {v:"transmettre", l:"Transmettre mon patrimoine"},{v:"proteger_conjoint", l:"Protéger mon conjoint"},
        {v:"cession_entreprise", l:"Préparer une cession d'entreprise"},{v:"etudes_enfants", l:"Financer les études de mes enfants"},
        {v:"epargne_securite", l:"Constituer une épargne de sécurité"},
      ]},
    ]
  },
  {
    id:"profil-investisseur", title:"Profil investisseur", subtitle:"Ces éléments orientent le type de solutions adaptées à votre profil.",
    fields:[
      {id:"appetence", label:"Appétence au risque", type:"select", required:true, options:[
        {v:"prudent", l:"Prudent"},{v:"modere", l:"Modéré"},{v:"equilibre", l:"Équilibré"},{v:"dynamique", l:"Dynamique"},{v:"offensif", l:"Offensif"},
      ]},
      {id:"horizon", label:"Horizon de placement", type:"select", required:true, options:[
        {v:"court", l:"Moins de 3 ans"},{v:"moyen", l:"3 à 8 ans"},{v:"long", l:"Plus de 8 ans"},
      ]},
      {id:"experience", label:"Expérience en matière d'investissement", type:"select", required:true, options:[
        {v:"debutant", l:"Débutant"},{v:"intermediaire", l:"Intermédiaire"},{v:"confirme", l:"Confirmé"},{v:"expert", l:"Expert"},
      ]},
    ]
  },
  {
    id:"commentaire", title:"Un dernier mot avant d'envoyer votre dossier",
    subtitle:"Souhaitez-vous nous communiquer une information ou une demande particulière ? Ce champ est facultatif.",
    fields:[
      {id:"commentaireLibre", label:"Votre commentaire", type:"textarea", required:false, placeholder:"Ex. contraintes particulières, questions, disponibilités pour un rendez-vous..."},
    ]
  },
];

/* ==========================================================================
   3. MOTEUR DE RENDU
   ========================================================================== */
let currentStep = 0;

const els = {
  intro: document.getElementById("intro"),
  wizard: document.getElementById("wizard"),
  finalScreen: document.getElementById("finalScreen"),
  stepContainer: document.getElementById("stepContainer"),
  progressFill: document.getElementById("progressFill"),
  progressStepLabel: document.getElementById("progressStepLabel"),
  progressStepTitle: document.getElementById("progressStepTitle"),
  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  stepError: document.getElementById("stepError"),
  btnStart: document.getElementById("btnStart"),
};

function num(v){ if(v===undefined||v===null||v==="") return 0; const n=parseFloat(String(v).replace(/\s/g,"").replace(",",".")); return isNaN(n)?0:n; }
function eur(n){ return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n||0); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function labelOf(options, v){ const o=(options||[]).find(o=>o.v===v); return o?o.l:""; }

function buildProgress(){
  const step = STEPS[currentStep];
  els.progressStepLabel.textContent = `Étape ${currentStep+1} / ${STEPS.length}`;
  els.progressStepTitle.textContent = step.title;
  els.progressFill.style.width = ((currentStep+1)/STEPS.length*100) + "%";
}

function renderField(f, getVal, item){
  if(f.condition && !f.condition(state)) return "";
  if(f.itemCondition && item && !f.itemCondition(item)) return "";
  const val = getVal(f.id || f.key);
  const name = f.id || f.key;
  const opts = typeof f.options === "function" ? f.options() : f.options;
  const highlightClass = f.highlight ? " field-highlight" : "";

  if(f.type==="select"){
    return `
      <div class="field${highlightClass}" data-field="${name}">
        <label for="f_${name}">${f.label}${f.required?' *':''}</label>
        <select id="f_${name}" data-name="${name}" ${f.required?'required':''}>
          <option value="" ${!val?'selected':''} disabled>Sélectionner...</option>
          ${opts.map(o=>`<option value="${o.v}" ${val===o.v?'selected':''}>${esc(o.l)}</option>`).join("")}
        </select>
        ${f.help?`<div class="field-help">${esc(f.help)}</div>`:""}
      </div>`;
  }
  if(f.type==="checkbox-group"){
    const arr = Array.isArray(val) ? val : [];
    return `
      <div class="field" data-field="${name}">
        <label>${f.label}${f.required?' *':''}</label>
        <div class="option-grid">
          ${f.options.map(o=>`
            <label class="option-card">
              <input type="checkbox" data-name="${name}" value="${o.v}" ${arr.includes(o.v)?'checked':''}>
              <span class="box"><span class="dot"></span>${esc(o.l)}</span>
            </label>`).join("")}
        </div>
      </div>`;
  }
  if(f.type==="textarea"){
    return `
      <div class="field" data-field="${name}" style="grid-column:1 / -1;">
        <label for="f_${name}">${f.label}${f.required?' *':''}</label>
        <textarea id="f_${name}" data-name="${name}" rows="5" placeholder="${esc(f.placeholder||"")}">${esc(val)}</textarea>
        ${f.help?`<div class="field-help">${esc(f.help)}</div>`:""}
      </div>`;
  }
  return `
    <div class="field" data-field="${name}">
      <label for="f_${name}">${f.label}${f.required?' *':''}</label>
      <input type="${f.type}" id="f_${name}" data-name="${name}" value="${esc(val)}"
        ${f.min!==undefined?`min="${f.min}"`:""} placeholder="${esc(f.placeholder||"")}" ${f.required?'required':''}>
      ${f.help?`<div class="field-help">${esc(f.help)}</div>`:""}
    </div>`;
}

const TYPE_CONTRAT_OPTIONS = [
  {v:"cdi", l:"CDI"},{v:"cdd", l:"CDD"},{v:"tns", l:"TNS"},{v:"fonctionnaire", l:"Fonctionnaire"},{v:"autre", l:"Autre"},
];

function personneIdentityFields(prefix, condition){
  return [
    {id:prefix+"nom", label:"Nom", type:"text", required:true, condition},
    {id:prefix+"prenom", label:"Prénom", type:"text", required:true, condition},
    {id:prefix+"dateNaissance", label:"Date de naissance", type:"date"},
    {id:prefix+"lieuNaissance", label:"Lieu de naissance", type:"text"},
    {id:prefix+"nationalite", label:"Nationalité", type:"text"},
    {id:prefix+"profession", label:"Profession", type:"text"},
    {id:prefix+"employeur", label:"Employeur", type:"text"},
    {id:prefix+"anciennete", label:"Ancienneté", type:"text", placeholder:"Ex. 6 ans"},
    {id:prefix+"typeContrat", label:"Type de contrat", type:"select", options:TYPE_CONTRAT_OPTIONS},
    {id:prefix+"regimeRetraite", label:"Régime de retraite", type:"text"},
    {id:prefix+"telephone", label:"Téléphone", type:"tel"},
    {id:prefix+"email", label:"E-mail", type:"email"},
  ];
}
function personneRevenusGroups(prefix){
  return [
    { title:"Revenus annuels", fields:[
      {id:prefix+"revenuSalaries", label:"Revenus salariés (€)", type:"number", min:0},
      {id:prefix+"dividendes", label:"Dividendes (€)", type:"number", min:0},
      {id:prefix+"revenusFonciers", label:"Revenus fonciers (€)", type:"number", min:0},
      {id:prefix+"bicBnc", label:"BIC / BNC (€)", type:"number", min:0},
      {id:prefix+"autresRevenus", label:"Autres revenus (€)", type:"number", min:0},
    ]},
    { title:"Charges annuelles", fields:[
      {id:prefix+"chargesLoyer", label:"Loyer (€)", type:"number", min:0},
      {id:prefix+"chargesCredits", label:"Crédits (€)", type:"number", min:0},
      {id:prefix+"chargesImpots", label:"Impôts (€)", type:"number", min:0},
      {id:prefix+"chargesIfi", label:"IFI (€)", type:"number", min:0},
      {id:prefix+"chargesCopro", label:"Charges de copropriété (€)", type:"number", min:0},
      {id:prefix+"trainDeVie", label:"Train de vie annuel (€)", type:"number", min:0},
    ]},
  ];
}

const PERSONNE_B_IDENTITY_FIELDS = personneIdentityFields("pb_", s=>s.hasPersonneB);
const PERSONNE_B_REVENUS_GROUPS = personneRevenusGroups("pb_");
const PERSONNE_C_IDENTITY_FIELDS = personneIdentityFields("pc_", s=>s.hasPersonneC);
const PERSONNE_C_REVENUS_GROUPS = personneRevenusGroups("pc_");

function renderPersonneToggle(has, addId, removeId, addText, removeText){
  if(has){
    return `
      <div class="personne-b-banner">
        <span>${removeText}</span>
        <button type="button" id="${removeId}" class="btn-add-remove">Retirer cette personne</button>
      </div>`;
  }
  return `
    <button type="button" id="${addId}" class="btn-add" style="margin-top:6px;">
      <span class="plus">+</span> ${addText}
    </button>`;
}
function renderPersonneFieldsBlock(title, fields){
  const getVal = getFieldValue;
  return `
    <div class="step-group-title">${esc(title)}</div>
    <div class="field-grid">${fields.map(f=>renderField(f,getVal)).join("")}</div>`;
}
function renderPersonneRevenusBlock(title, groups){
  const getVal = getFieldValue;
  return groups.map(g=>`
    <div class="step-group-title">${esc(title)} — ${esc(g.title)}</div>
    <div class="field-grid">${g.fields.map(f=>renderField(f,getVal)).join("")}</div>
  `).join("");
}

function renderStandardStep(step){
  const getVal = getFieldValue;
  let extra = "";
  if(step.id==="etat-civil"){
    extra = renderPersonneToggle(state.hasPersonneB, "btnAddPersonneB", "btnRemovePersonneB",
      "Ajouter une seconde personne à l'analyse (conjoint, associé...)", "Une seconde personne est ajoutée à cette analyse.")
      + (state.hasPersonneB ? renderPersonneFieldsBlock("Seconde personne — état civil", PERSONNE_B_IDENTITY_FIELDS) : "");
    if(state.hasPersonneB){
      extra += renderPersonneToggle(state.hasPersonneC, "btnAddPersonneC", "btnRemovePersonneC",
        "Ajouter une troisième personne à l'analyse", "Une troisième personne est ajoutée à cette analyse.")
        + (state.hasPersonneC ? renderPersonneFieldsBlock("Troisième personne — état civil", PERSONNE_C_IDENTITY_FIELDS) : "");
    }
  }
  if(step.id==="revenus-charges"){
    if(state.hasPersonneB) extra += renderPersonneRevenusBlock("Seconde personne", PERSONNE_B_REVENUS_GROUPS);
    if(state.hasPersonneC) extra += renderPersonneRevenusBlock("Troisième personne", PERSONNE_C_REVENUS_GROUPS);
  }
  if(step.groups){
    return `<h2 class="step-title">${esc(step.title)}</h2>
      <p class="step-subtitle">${esc(step.subtitle)}</p>
      ${step.groups.map(g=>`
        <div class="step-group-title">${esc(g.title)}</div>
        <div class="field-grid">${g.fields.map(f=>renderField(f,getVal)).join("")}</div>
      `).join("")}
      ${extra}`;
  }
  return `<h2 class="step-title">${esc(step.title)}</h2>
    <p class="step-subtitle">${esc(step.subtitle)}</p>
    <div class="field-grid">${step.fields.map(f=>renderField(f,getVal)).join("")}</div>
    ${extra}`;
}

/* -------- Répétables génériques (crédits, immobilier, actifs pro, supports financiers) -------- */
function repeaterCard(step, item, index){
  const getVal = (key)=> item[key];
  return `
    <div class="repeat-card" data-item-id="${item.id}" data-repeater-key="${step.repeaterKey}">
      <div class="repeat-card-head">
        <h4>${esc(step.itemLabel)} n°${index+1}</h4>
        <button type="button" class="repeat-remove" data-remove="${item.id}">✕ Retirer</button>
      </div>
      <div class="field-grid">
        ${step.itemFields.map(f=>renderField(f, getVal, item)).join("")}
      </div>
    </div>`;
}
function renderRepeaterStep(step){
  const list = state[step.repeaterKey];
  const cards = list.map((it,i)=>repeaterCard(step,it,i)).join("");
  return `<h2 class="step-title">${esc(step.title)}</h2>
    <p class="step-subtitle">${esc(step.subtitle)}</p>
    <div class="repeat-list" id="repeatList">
      ${cards || `<div class="empty-hint">Aucun élément ajouté pour le moment.</div>`}
    </div>
    <button type="button" id="btnAddItem" class="btn-add"><span class="plus">+</span> Ajouter ${step.addLabel||"un élément"}</button>`;
}

/* ==========================================================================
   5. ETAPE "FINANCIER" — supports fixes (Livret A, LDDS, LEP, PEA, compte-titres)
      + répétables (comptes courants, comptes à terme, assurance-vie, PER, épargne salariale)
   ========================================================================== */
const EPARGNE_COURT_TERME = [
  {key:"livretA", label:"Livret A"}, {key:"ldds", label:"LDDS"}, {key:"lep", label:"LEP"},
];
const EPARGNE_LONG_TERME = [
  {key:"pea", label:"PEA", anneeOuverture:true}, {key:"compteTitres", label:"Compte-titres"},
];
const COMPTE_COURANT_CONFIG = {
  repeaterKey:"comptesCourants", itemLabel:"Compte courant", addLabel:"un compte courant",
  itemFields:[
    {key:"banque", label:"Banque", type:"select", options:BANKS},
    {key:"proprietaire", label:"Titulaire", type:"select", condition:s=>s.hasPersonneB, options:proprietaireOptions, highlight:true},
    {key:"typeCompte", label:"Type de compte", type:"select", options:[
      {v:"personnel", l:"Personnel"}, {v:"joint", l:"Joint / commun"},
    ]},
    {key:"valeur", label:"Solde actuel (€)", type:"number", min:0},
  ]
};
const COMPTE_TERME_CONFIG = {
  repeaterKey:"comptesTerme", itemLabel:"Compte à terme", addLabel:"un compte à terme",
  itemFields:[
    {key:"banque", label:"Banque", type:"select", options:BANKS},
    {key:"proprietaire", label:"Titulaire", type:"select", condition:s=>s.hasPersonneB, options:proprietaireOptions, highlight:true},
    {key:"valeur", label:"Valeur actuelle (€)", type:"number", min:0},
  ]
};
const ASSURANCE_VIE_CONFIG = {
  repeaterKey:"assurancesVie", itemLabel:"Assurance-vie", addLabel:"une assurance-vie",
  itemFields:[
    {key:"banque", label:"Compagnie / banque", type:"select", options:BANKS},
    {key:"proprietaire", label:"Titulaire", type:"select", condition:s=>s.hasPersonneB, options:proprietaireOptions, highlight:true},
    {key:"valeur", label:"Valeur actuelle (€)", type:"number", min:0},
    {key:"anneeOuverture", label:"Année d'ouverture", type:"number", min:1950, placeholder:"Ex. 2015"},
    {key:"clauseBeneficiaire", label:"Clause bénéficiaire", type:"select", options:CLAUSE_BENEFICIAIRE_OPTIONS},
    {key:"clauseCommentaire", label:"Précisez votre clause sur-mesure", type:"textarea", itemCondition:item=>item.clauseBeneficiaire==="sur_mesure"},
  ]
};
const PER_CONFIG = {
  repeaterKey:"pers", itemLabel:"PER", addLabel:"un PER",
  itemFields:[
    {key:"banque", label:"Compagnie / banque", type:"select", options:BANKS},
    {key:"proprietaire", label:"Titulaire", type:"select", condition:s=>s.hasPersonneB, options:proprietaireOptions, highlight:true},
    {key:"valeur", label:"Valeur actuelle (€)", type:"number", min:0},
    {key:"anneeOuverture", label:"Année d'ouverture", type:"number", min:1950, placeholder:"Ex. 2015"},
    {key:"clauseBeneficiaire", label:"Clause bénéficiaire", type:"select", options:CLAUSE_BENEFICIAIRE_OPTIONS},
    {key:"clauseCommentaire", label:"Précisez votre clause sur-mesure", type:"textarea", itemCondition:item=>item.clauseBeneficiaire==="sur_mesure"},
  ]
};
const EPARGNE_SALARIALE_CONFIG = {
  repeaterKey:"epargneSalariale", itemLabel:"Épargne salariale", addLabel:"un support d'épargne salariale",
  itemFields:[
    {key:"typeSupport", label:"Type de support", type:"select", options:[{v:"pee", l:"PEE"},{v:"perco", l:"PERCO"}]},
    {key:"banque", label:"Banque / teneur de compte", type:"select", options:BANKS},
    {key:"proprietaire", label:"Titulaire", type:"select", condition:s=>s.hasPersonneB, options:proprietaireOptions, highlight:true},
    {key:"valeur", label:"Valeur actuelle (€)", type:"number", min:0},
  ]
};
const FINANCIER_REPEATERS = [COMPTE_COURANT_CONFIG, COMPTE_TERME_CONFIG, ASSURANCE_VIE_CONFIG, PER_CONFIG, EPARGNE_SALARIALE_CONFIG];

function epargneRow(s){
  const val = state.epargne[s.key];
  const ownerField = state.hasPersonneB ? `
    <div class="field field-highlight">
      <label for="f_epo_${s.key}">${s.label} — titulaire</label>
      <select id="f_epo_${s.key}" data-epargne-owner="${s.key}">
        <option value="" ${!val.proprietaire?'selected':''} disabled>Sélectionner...</option>
        ${proprietaireOptions().map(o=>`<option value="${o.v}" ${val.proprietaire===o.v?'selected':''}>${esc(o.l)}</option>`).join("")}
      </select>
    </div>` : "";
  const yearField = s.anneeOuverture ? `
    <div class="field">
      <label for="f_epy_${s.key}">${s.label} — année d'ouverture</label>
      <input type="number" min="1950" id="f_epy_${s.key}" data-epargne-year="${s.key}" value="${esc(val.anneeOuverture||"")}" placeholder="Ex. 2015">
    </div>` : "";
  return `
    <div class="field">
      <label for="f_epb_${s.key}">${s.label} — banque</label>
      <select id="f_epb_${s.key}" data-epargne-bank="${s.key}">
        <option value="" ${!val.banque?'selected':''} disabled>Sélectionner...</option>
        ${BANKS.map(o=>`<option value="${o.v}" ${val.banque===o.v?'selected':''}>${esc(o.l)}</option>`).join("")}
      </select>
    </div>
    <div class="field">
      <label for="f_epv_${s.key}">${s.label} — valeur actuelle (€)</label>
      <input type="number" min="0" id="f_epv_${s.key}" data-epargne-value="${s.key}" value="${esc(val.valeur)}" placeholder="0">
    </div>
    ${yearField}
    ${ownerField}`;
}
function repeaterSection(config, title, emptyText){
  const list = state[config.repeaterKey];
  const cards = list.map((it,i)=>repeaterCard(config,it,i)).join("");
  return `
    <div class="step-group-title">${esc(title)}</div>
    <div class="repeat-list">
      ${cards || `<div class="empty-hint">${esc(emptyText)}</div>`}
    </div>
    <button type="button" id="btnAdd_${config.repeaterKey}" class="btn-add"><span class="plus">+</span> Ajouter ${config.addLabel}</button>`;
}
function renderFinancierStep(step){
  const gridClass = "field-grid" + (state.hasPersonneB ? " cols-3" : "");
  return `<h2 class="step-title">${esc(step.title)}</h2>
    <p class="step-subtitle">${esc(step.subtitle)}</p>

    ${repeaterSection(COMPTE_COURANT_CONFIG, "Comptes courants", "Aucun compte courant ajouté pour le moment.")}

    <div class="step-group-title">Épargne court terme</div>
    <div class="${gridClass}">${EPARGNE_COURT_TERME.map(epargneRow).join("")}</div>

    ${repeaterSection(COMPTE_TERME_CONFIG, "Comptes à terme", "Aucun compte à terme ajouté pour le moment.")}
    ${repeaterSection(ASSURANCE_VIE_CONFIG, "Assurance-vie", "Aucune assurance-vie ajoutée pour le moment.")}
    ${repeaterSection(PER_CONFIG, "PER", "Aucun PER ajouté pour le moment.")}
    ${repeaterSection(EPARGNE_SALARIALE_CONFIG, "Épargne salariale", "Aucun support d'épargne salariale ajouté pour le moment.")}

    <div class="step-group-title">Autres supports long terme</div>
    <div class="${gridClass}">${EPARGNE_LONG_TERME.map(epargneRow).join("")}</div>`;
}

function renderStep(){
  const step = STEPS[currentStep];
  let html;
  if(step.repeaterKey) html = renderRepeaterStep(step);
  else if(step.financier) html = renderFinancierStep(step);
  else html = renderStandardStep(step);

  els.stepContainer.innerHTML = html;
  bindStepEvents(step);
  buildProgress();

  els.btnPrev.style.visibility = currentStep===0 ? "hidden" : "visible";
  els.btnNext.textContent = currentStep===STEPS.length-1 ? "Terminer mon analyse →" : "Suivant →";
  els.stepError.textContent = "";
  window.scrollTo({top: els.wizard.offsetTop - 20, behavior:"smooth"});
}

function bindStepEvents(step){
  // champs standards (id direct sur state, ou pb_xxx/pc_xxx -> personneB/personneC) et supports financiers (state.epargne)
  // — on exclut les champs situés dans un bloc répétable, gérés séparément plus bas.
  Array.from(els.stepContainer.querySelectorAll("[data-name]")).filter(el=>!el.closest(".repeat-card")).forEach(input=>{
    if(input.type==="checkbox"){
      input.addEventListener("change", ()=>{
        const name = input.getAttribute("data-name");
        const wrap = input.closest("[data-field]");
        const checked = Array.from(wrap.querySelectorAll('input[type=checkbox]:checked')).map(x=>x.value);
        setFieldValue(name, checked);
        saveState();
      });
    } else {
      const handler = ()=>{
        const name = input.getAttribute("data-name");
        setFieldValue(name, input.value);
        saveState();
        if(name==="situationFamiliale") renderStep();
      };
      input.addEventListener("input", handler);
      if(input.tagName==="SELECT") input.addEventListener("change", handler);
    }
  });
  const btnAddPB = document.getElementById("btnAddPersonneB");
  if(btnAddPB) btnAddPB.addEventListener("click", ()=>{ state.hasPersonneB = true; saveState(); renderStep(); });
  const btnRemovePB = document.getElementById("btnRemovePersonneB");
  if(btnRemovePB) btnRemovePB.addEventListener("click", ()=>{ state.hasPersonneB = false; state.hasPersonneC = false; saveState(); renderStep(); });
  const btnAddPC = document.getElementById("btnAddPersonneC");
  if(btnAddPC) btnAddPC.addEventListener("click", ()=>{ state.hasPersonneC = true; saveState(); renderStep(); });
  const btnRemovePC = document.getElementById("btnRemovePersonneC");
  if(btnRemovePC) btnRemovePC.addEventListener("click", ()=>{ state.hasPersonneC = false; saveState(); renderStep(); });

  els.stepContainer.querySelectorAll("[data-epargne-bank]").forEach(input=>{
    input.addEventListener("change", ()=>{
      state.epargne[input.getAttribute("data-epargne-bank")].banque = input.value;
      saveState();
    });
  });
  els.stepContainer.querySelectorAll("[data-epargne-value]").forEach(input=>{
    input.addEventListener("input", ()=>{
      state.epargne[input.getAttribute("data-epargne-value")].valeur = input.value;
      saveState();
    });
  });
  els.stepContainer.querySelectorAll("[data-epargne-owner]").forEach(input=>{
    input.addEventListener("change", ()=>{
      state.epargne[input.getAttribute("data-epargne-owner")].proprietaire = input.value;
      saveState();
    });
  });
  els.stepContainer.querySelectorAll("[data-epargne-year]").forEach(input=>{
    input.addEventListener("input", ()=>{
      state.epargne[input.getAttribute("data-epargne-year")].anneeOuverture = input.value;
      saveState();
    });
  });

  // répétables de l'étape financière
  if(step.financier){
    FINANCIER_REPEATERS.forEach(cfg=>{
      const btn = document.getElementById("btnAdd_"+cfg.repeaterKey);
      if(btn) btn.addEventListener("click", ()=>addRepeaterItem(cfg));
      bindRepeaterCards(cfg);
    });
  }

  // répétables génériques (crédits, immobilier, actifs pro)
  const btnAdd = document.getElementById("btnAddItem");
  if(btnAdd) btnAdd.addEventListener("click", ()=>addRepeaterItem(step));
  if(step.repeaterKey) bindRepeaterCards(step);

  // retrait d'un élément répétable, quel que soit son répétable d'origine
  els.stepContainer.querySelectorAll("[data-remove]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const card = b.closest("[data-item-id]");
      const repeaterKey = card.getAttribute("data-repeater-key");
      const config = REPEATER_CONFIG_BY_KEY[repeaterKey];
      if(config) removeRepeaterItem(config, b.getAttribute("data-remove"));
    });
  });
}

function bindRepeaterCards(config){
  els.stepContainer.querySelectorAll(`[data-item-id][data-repeater-key="${config.repeaterKey}"]`).forEach(card=>{
    const itemId = card.getAttribute("data-item-id");
    const item = state[config.repeaterKey].find(i=>i.id===itemId);
    if(!item) return;
    card.querySelectorAll("input,select,textarea").forEach(input=>{
      const key = input.getAttribute("data-name");
      if(!key) return;
      if(input.tagName==="SELECT"){
        input.addEventListener("change", ()=>{ item[key]=input.value; saveState(); renderStep(); });
      } else {
        input.addEventListener("input", ()=>{ item[key]=input.value; saveState(); });
      }
    });
  });
}

function addRepeaterItem(step){
  idSeq[step.repeaterKey] = (idSeq[step.repeaterKey]||0) + 1;
  const prefixMap = {
    credits:"c", biensImmo:"b", actifsPro:"a", comptesCourants:"cc",
    comptesTerme:"ct", assurancesVie:"av", pers:"per", epargneSalariale:"es",
  };
  const prefix = prefixMap[step.repeaterKey] || "x";
  const item = {id: prefix+idSeq[step.repeaterKey]};
  step.itemFields.forEach(f=> item[f.key]="");
  state[step.repeaterKey].push(item);
  saveState();
  renderStep();
}
function removeRepeaterItem(step, id){
  state[step.repeaterKey] = state[step.repeaterKey].filter(i=>i.id!==id);
  saveState();
  renderStep();
}

/* Table de correspondance repeaterKey -> config, utilisée pour retrouver la bonne config au retrait d'un élément */
const REPEATER_CONFIG_BY_KEY = {};
STEPS.forEach(s=>{ if(s.repeaterKey) REPEATER_CONFIG_BY_KEY[s.repeaterKey] = s; });
FINANCIER_REPEATERS.forEach(cfg=>{ REPEATER_CONFIG_BY_KEY[cfg.repeaterKey] = cfg; });

/* ==========================================================================
   4. NAVIGATION / VALIDATION
   ========================================================================== */
function validateCurrentStep(){
  const step = STEPS[currentStep];
  let fieldsToCheck = step.fields || (step.groups ? step.groups.flatMap(g=>g.fields) : []);
  if(step.id==="etat-civil") fieldsToCheck = fieldsToCheck.concat(PERSONNE_B_IDENTITY_FIELDS).concat(PERSONNE_C_IDENTITY_FIELDS);
  if(step.id==="revenus-charges") fieldsToCheck = fieldsToCheck.concat(PERSONNE_B_REVENUS_GROUPS.flatMap(g=>g.fields)).concat(PERSONNE_C_REVENUS_GROUPS.flatMap(g=>g.fields));
  for(const f of fieldsToCheck){
    if(f.condition && !f.condition(state)) continue;
    if(!f.required) continue;
    const v = getFieldValue(f.id);
    if(f.type==="checkbox-group"){
      if(!Array.isArray(v) || v.length===0) return `Merci de sélectionner au moins une option pour « ${f.label} ».`;
    } else if(v===undefined || v===null || String(v).trim()===""){
      return `Merci de renseigner « ${f.label} ».`;
    }
  }
  if(step.id==="etat-civil" && state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)){
    return "Merci de renseigner une adresse e-mail valide.";
  }
  return null;
}

els.btnNext.addEventListener("click", ()=>{
  const err = validateCurrentStep();
  if(err){ els.stepError.textContent = err; return; }
  els.stepError.textContent = "";
  if(currentStep < STEPS.length-1){
    currentStep++;
    saveState();
    renderStep();
  } else {
    finishWizard();
  }
});
els.btnPrev.addEventListener("click", ()=>{
  if(currentStep>0){ currentStep--; saveState(); renderStep(); }
});

function startWizard(){
  els.intro.hidden = true;
  els.wizard.hidden = false;
  renderStep();
}
els.btnStart.addEventListener("click", ()=>{ currentStep = 0; startWizard(); });

/* ==========================================================================
   6. ECRAN DE FIN + EXPORT PDF + ENVOI DU DOSSIER AU CABINET
   ========================================================================== */
function calculerAge(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr);
  if(isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if(m < 0 || (m===0 && today.getDate() < d.getDate())) age--;
  return age;
}
function revenusTotal(p){ return num(p.revenuSalaries)+num(p.dividendes)+num(p.revenusFonciers)+num(p.bicBnc)+num(p.autresRevenus); }
function chargesTotal(p){ return num(p.chargesLoyer)+num(p.chargesCredits)+num(p.chargesImpots)+num(p.chargesIfi)+num(p.chargesCopro)+num(p.trainDeVie); }

function buildClientRecapText(){
  const s = state;
  const date = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const ownerLabel = (v)=> v ? (labelOf(proprietaireOptions(), v) || "") : "";
  const ownerSuffix = (v)=> ownerLabel(v) ? ` [${ownerLabel(v)}]` : "";
  const row = (label, value) => `${label} : ${(value===0?"0":value) || "—"}`;
  const lines = [];

  // --- Synthèse chiffrée (calculs pour orienter le diagnostic) ---
  const ageA = calculerAge(s.dateNaissance);
  const ageB = s.hasPersonneB ? calculerAge(s.personneB.dateNaissance) : null;
  const ageC = s.hasPersonneC ? calculerAge(s.personneC.dateNaissance) : null;

  const patrimoineImmo = s.biensImmo.reduce((sum,b)=>sum+num(b.valeur),0);
  const patrimoineComptes = s.comptesCourants.reduce((sum,c)=>sum+num(c.valeur),0);
  const patrimoineTerme = s.comptesTerme.reduce((sum,c)=>sum+num(c.valeur),0);
  const patrimoineAssuranceVie = s.assurancesVie.reduce((sum,c)=>sum+num(c.valeur),0);
  const patrimoinePer = s.pers.reduce((sum,c)=>sum+num(c.valeur),0);
  const patrimoineEpargneSalariale = s.epargneSalariale.reduce((sum,c)=>sum+num(c.valeur),0);
  const patrimoineEpargneFixe = [...EPARGNE_COURT_TERME, ...EPARGNE_LONG_TERME].reduce((sum,x)=>sum+num(s.epargne[x.key].valeur),0);
  const patrimoinePro = s.actifsPro.reduce((sum,a)=>sum+num(a.valeurEstimee),0);
  const patrimoineBrut = patrimoineImmo + patrimoineComptes + patrimoineTerme + patrimoineAssuranceVie + patrimoinePer + patrimoineEpargneSalariale + patrimoineEpargneFixe + patrimoinePro;

  const dettesCredits = s.credits.reduce((sum,c)=>sum+num(c.capitalRestant),0);
  const dettesImmo = s.biensImmo.reduce((sum,b)=>sum+num(b.capitalRestant),0);
  const dettesTotales = dettesCredits + dettesImmo;
  const patrimoineNet = patrimoineBrut - dettesTotales;

  const revenusTotaux = revenusTotal(s) + (s.hasPersonneB?revenusTotal(s.personneB):0) + (s.hasPersonneC?revenusTotal(s.personneC):0);
  const chargesTotales = chargesTotal(s) + (s.hasPersonneB?chargesTotal(s.personneB):0) + (s.hasPersonneC?chargesTotal(s.personneC):0);
  const capaciteEpargne = revenusTotaux - chargesTotales;

  lines.push("DOSSIER D'ANALYSE PATRIMONIALE — LIONCREST CAPITAL");
  lines.push("Reçu le " + date);
  lines.push("");

  lines.push("== SYNTHÈSE CHIFFRÉE ==");
  lines.push(row("Âge — Personne A", ageA!==null ? ageA+" ans" : ""));
  if(s.hasPersonneB) lines.push(row("Âge — Personne B", ageB!==null ? ageB+" ans" : ""));
  if(s.hasPersonneC) lines.push(row("Âge — Personne C", ageC!==null ? ageC+" ans" : ""));
  lines.push(row("Patrimoine brut (immobilier + comptes + épargne + pro)", eur(patrimoineBrut)));
  lines.push(row("Dettes totales (crédits + capital restant dû immobilier)", eur(dettesTotales)));
  lines.push(row("Patrimoine net", eur(patrimoineNet)));
  lines.push(row("Revenus annuels totaux du foyer", eur(revenusTotaux)));
  lines.push(row("Charges annuelles totales du foyer", eur(chargesTotales)));
  lines.push(row("Capacité d'épargne annuelle estimée", eur(capaciteEpargne)));
  lines.push("");

  lines.push("== ÉTAT CIVIL — PERSONNE A ==");
  lines.push(row("Nom", s.nom));
  lines.push(row("Prénom", s.prenom));
  lines.push(row("Date de naissance", s.dateNaissance));
  lines.push(row("Lieu de naissance", s.lieuNaissance));
  lines.push(row("Nationalité", s.nationalite));
  lines.push(row("Profession", s.profession));
  lines.push(row("Employeur", s.employeur));
  lines.push(row("Ancienneté", s.anciennete));
  lines.push(row("Type de contrat", labelOf(TYPE_CONTRAT_OPTIONS, s.typeContrat)));
  lines.push(row("Régime de retraite", s.regimeRetraite));
  lines.push(row("Adresse", s.adresse));
  lines.push(row("Téléphone", s.telephone));
  lines.push(row("E-mail", s.email));
  lines.push(row("Situation familiale", labelOf(SITUATION_OPTIONS, s.situationFamiliale)));
  if(s.situationFamiliale === "marie"){
    lines.push(row("Régime matrimonial", labelOf(REGIME_OPTIONS, s.regimeMatrimonial)));
  }
  lines.push("");

  function pushPersonneEtatCivil(label, p){
    lines.push(`== ÉTAT CIVIL — ${label} ==`);
    lines.push(row("Nom", p.nom));
    lines.push(row("Prénom", p.prenom));
    lines.push(row("Date de naissance", p.dateNaissance));
    lines.push(row("Lieu de naissance", p.lieuNaissance));
    lines.push(row("Nationalité", p.nationalite));
    lines.push(row("Profession", p.profession));
    lines.push(row("Employeur", p.employeur));
    lines.push(row("Ancienneté", p.anciennete));
    lines.push(row("Type de contrat", labelOf(TYPE_CONTRAT_OPTIONS, p.typeContrat)));
    lines.push(row("Régime de retraite", p.regimeRetraite));
    lines.push(row("Téléphone", p.telephone));
    lines.push(row("E-mail", p.email));
    lines.push("");
  }
  if(s.hasPersonneB) pushPersonneEtatCivil("PERSONNE B", s.personneB);
  if(s.hasPersonneC) pushPersonneEtatCivil("PERSONNE C", s.personneC);

  lines.push("== REVENUS ET CHARGES ANNUELS — PERSONNE A ==");
  lines.push(row("Revenus salariés", eur(num(s.revenuSalaries))));
  lines.push(row("Dividendes", eur(num(s.dividendes))));
  lines.push(row("Revenus fonciers", eur(num(s.revenusFonciers))));
  lines.push(row("BIC / BNC", eur(num(s.bicBnc))));
  lines.push(row("Autres revenus", eur(num(s.autresRevenus))));
  lines.push(row("Charges — loyer", eur(num(s.chargesLoyer))));
  lines.push(row("Charges — crédits", eur(num(s.chargesCredits))));
  lines.push(row("Charges — impôts", eur(num(s.chargesImpots))));
  lines.push(row("Charges — IFI", eur(num(s.chargesIfi))));
  lines.push(row("Charges — copropriété", eur(num(s.chargesCopro))));
  lines.push(row("Train de vie annuel", eur(num(s.trainDeVie))));
  lines.push("");

  function pushPersonneRevenus(label, p){
    lines.push(`== REVENUS ET CHARGES ANNUELS — ${label} ==`);
    lines.push(row("Revenus salariés", eur(num(p.revenuSalaries))));
    lines.push(row("Dividendes", eur(num(p.dividendes))));
    lines.push(row("Revenus fonciers", eur(num(p.revenusFonciers))));
    lines.push(row("BIC / BNC", eur(num(p.bicBnc))));
    lines.push(row("Autres revenus", eur(num(p.autresRevenus))));
    lines.push(row("Charges — loyer", eur(num(p.chargesLoyer))));
    lines.push(row("Charges — crédits", eur(num(p.chargesCredits))));
    lines.push(row("Charges — impôts", eur(num(p.chargesImpots))));
    lines.push(row("Charges — IFI", eur(num(p.chargesIfi))));
    lines.push(row("Charges — copropriété", eur(num(p.chargesCopro))));
    lines.push(row("Train de vie annuel", eur(num(p.trainDeVie))));
    lines.push("");
  }
  if(s.hasPersonneB) pushPersonneRevenus("PERSONNE B", s.personneB);
  if(s.hasPersonneC) pushPersonneRevenus("PERSONNE C", s.personneC);

  lines.push("== CRÉDITS EN COURS ==");
  if(s.credits.length){
    s.credits.forEach((c,i)=>{
      lines.push(`  ${i+1}. ${labelOf(STEPS[2].itemFields[0].options,c.type)||"Crédit"} — ${labelOf(BANKS,c.banque)||"banque non renseignée"}`);
      lines.push(`     Mensualité : ${eur(num(c.mensualite))} · Capital restant dû : ${eur(num(c.capitalRestant))} · Fin : ${c.dateFin||"—"}`);
    });
  } else lines.push("  Aucun crédit renseigné");
  lines.push("");

  lines.push("== PATRIMOINE IMMOBILIER ==");
  if(s.biensImmo.length){
    s.biensImmo.forEach((b,i)=>{
      lines.push(`  ${i+1}. ${labelOf(STEPS[3].itemFields[0].options,b.type)||"Bien"}${b.adresse?" — "+b.adresse:""}${ownerSuffix(b.proprietaire)}`);
      lines.push(`     Valeur : ${eur(num(b.valeur))} · Capital restant dû : ${eur(num(b.capitalRestant))} · Revenus locatifs : ${eur(num(b.revenusLocatifs))} · DPE : ${(b.dpe||"—").toUpperCase()}`);
    });
  } else lines.push("  Aucun bien renseigné");
  lines.push("");

  lines.push("== COMPTES COURANTS ==");
  if(s.comptesCourants.length){
    s.comptesCourants.forEach((c,i)=>{
      lines.push(`  ${i+1}. Compte ${labelOf(COMPTE_COURANT_CONFIG.itemFields[2].options,c.typeCompte)||"courant"} — ${labelOf(BANKS,c.banque)||"banque non renseignée"}${ownerSuffix(c.proprietaire)} : ${eur(num(c.valeur))}`);
    });
  } else lines.push("  Aucun compte courant renseigné");
  lines.push("");

  lines.push("== COMPTES À TERME ==");
  if(s.comptesTerme.length){
    s.comptesTerme.forEach((c,i)=>{
      lines.push(`  ${i+1}. ${labelOf(BANKS,c.banque)||"banque non renseignée"}${ownerSuffix(c.proprietaire)} : ${eur(num(c.valeur))}`);
    });
  } else lines.push("  Aucun compte à terme renseigné");
  lines.push("");

  lines.push("== ASSURANCE-VIE ==");
  if(s.assurancesVie.length){
    s.assurancesVie.forEach((c,i)=>{
      lines.push(`  ${i+1}. ${labelOf(BANKS,c.banque)||"banque non renseignée"}${ownerSuffix(c.proprietaire)} : ${eur(num(c.valeur))} · Ouverture : ${c.anneeOuverture||"—"}`);
      const clause = labelOf(CLAUSE_BENEFICIAIRE_OPTIONS, c.clauseBeneficiaire) || "—";
      lines.push(`     Clause bénéficiaire : ${clause}${c.clauseBeneficiaire==="sur_mesure" && c.clauseCommentaire ? " — " + c.clauseCommentaire : ""}`);
    });
  } else lines.push("  Aucune assurance-vie renseignée");
  lines.push("");

  lines.push("== PER ==");
  if(s.pers.length){
    s.pers.forEach((c,i)=>{
      lines.push(`  ${i+1}. ${labelOf(BANKS,c.banque)||"banque non renseignée"}${ownerSuffix(c.proprietaire)} : ${eur(num(c.valeur))} · Ouverture : ${c.anneeOuverture||"—"}`);
      const clause = labelOf(CLAUSE_BENEFICIAIRE_OPTIONS, c.clauseBeneficiaire) || "—";
      lines.push(`     Clause bénéficiaire : ${clause}${c.clauseBeneficiaire==="sur_mesure" && c.clauseCommentaire ? " — " + c.clauseCommentaire : ""}`);
    });
  } else lines.push("  Aucun PER renseigné");
  lines.push("");

  lines.push("== ÉPARGNE SALARIALE ==");
  if(s.epargneSalariale.length){
    s.epargneSalariale.forEach((c,i)=>{
      const type = c.typeSupport==="pee" ? "PEE" : c.typeSupport==="perco" ? "PERCO" : "—";
      lines.push(`  ${i+1}. ${type} — ${labelOf(BANKS,c.banque)||"banque non renseignée"}${ownerSuffix(c.proprietaire)} : ${eur(num(c.valeur))}`);
    });
  } else lines.push("  Aucun support d'épargne salariale renseigné");
  lines.push("");

  lines.push("== AUTRES SUPPORTS (épargne réglementée, PEA, compte-titres) ==");
  const epargneItems = [...EPARGNE_COURT_TERME, ...EPARGNE_LONG_TERME];
  const epargneRenseignee = epargneItems.filter(x=>num(s.epargne[x.key].valeur)>0);
  if(epargneRenseignee.length){
    epargneRenseignee.forEach(x=>{
      const v = s.epargne[x.key];
      const anneeSuffix = x.anneeOuverture && v.anneeOuverture ? ` · Ouverture : ${v.anneeOuverture}` : "";
      lines.push(`  ${x.label} — ${labelOf(BANKS,v.banque)||"banque non renseignée"}${ownerSuffix(v.proprietaire)} : ${eur(num(v.valeur))}${anneeSuffix}`);
    });
  } else lines.push("  Aucun support renseigné");
  lines.push("");

  lines.push("== ACTIFS PROFESSIONNELS ==");
  if(s.actifsPro.length){
    const FORMES = [{v:"sas",l:"SAS / SASU"},{v:"sarl",l:"SARL / EURL"},{v:"sci",l:"SCI"},{v:"sa",l:"SA"},{v:"autre",l:"Autre"}];
    s.actifsPro.forEach((a,i)=>{
      lines.push(`  ${i+1}. ${a.societe||"Société"} (${labelOf(FORMES,a.formeJuridique)||a.formeJuridique||"forme non renseignée"}) — ${a.pourcentageDetention||0}% détenu`);
      lines.push(`     Valeur estimée : ${eur(num(a.valeurEstimee))} · CA : ${eur(num(a.chiffreAffaires))} · Trésorerie : ${eur(num(a.tresorerie))} · Projet de cession : ${a.projetCession||"—"}`);
    });
  } else lines.push("  Aucun actif professionnel renseigné");
  lines.push("");

  lines.push("== PRÉVOYANCE ET PROTECTION ==");
  lines.push(row("Contrats de prévoyance", (s.prevoyanceContrats||[]).map(v=>labelOf(STEPS[6].fields[0].options,v)).join(", ")));
  lines.push(row("Documents juridiques existants", (s.prevoyanceDocuments||[]).map(v=>labelOf(STEPS[6].fields[1].options,v)).join(", ")));
  lines.push("");

  lines.push("== OBJECTIFS PATRIMONIAUX ==");
  lines.push("  " + ((s.objectifs||[]).map(v=>labelOf(STEPS[7].fields[0].options,v)).join(", ") || "—"));
  lines.push("");

  lines.push("== PROFIL INVESTISSEUR ==");
  lines.push(row("Appétence au risque", labelOf(STEPS[8].fields[0].options, s.appetence)));
  lines.push(row("Horizon de placement", labelOf(STEPS[8].fields[1].options, s.horizon)));
  lines.push(row("Expérience", labelOf(STEPS[8].fields[2].options, s.experience)));
  lines.push("");

  lines.push("== COMMENTAIRE DU CLIENT ==");
  lines.push("  " + (s.commentaireLibre && s.commentaireLibre.trim() ? s.commentaireLibre.trim() : "Aucun commentaire"));

  return lines.join("\n");
}

function sendClientRecapEmail(){
  if(!window.LioncrestMail){
    console.error("Envoi impossible : le service d'e-mail n'est pas chargé.");
    return;
  }
  const s = state;
  const clientNom = `${s.prenom||""} ${s.nom||""}`.trim() || "Client sans nom renseigné";
  window.LioncrestMail.send({
    subject: "Nouvelle analyse patrimoniale — " + clientNom,
    from_name: clientNom,
    reply_to: s.email || "",
    message: buildClientRecapText(),
  }).catch(function(err){
    console.error("Erreur lors de l'envoi du dossier au cabinet :", err);
  });
}

function finishWizard(){
  saveState();
  sendClientRecapEmail();
  els.wizard.hidden = true;
  els.finalScreen.hidden = false;
  window.scrollTo({top:0, behavior:"smooth"});
  clearSavedState();
}

document.getElementById("btnDownloadPdf").addEventListener("click", exportPdf);

function pr(label, value){
  return `<div class="pr-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function renderPrintReportIntoDom(){
  const date = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
  const s = state;

  const ownerLabel = (v)=> v ? (labelOf(proprietaireOptions(), v) || "") : "";
  const ownerSuffix = (v)=> ownerLabel(v) ? ` [${ownerLabel(v)}]` : "";

  const creditsHtml = s.credits.length ? s.credits.map(c=>`
    <div class="pr-row"><span>${esc(labelOf(STEPS[2].itemFields[0].options,c.type)||"Crédit")} — ${esc(labelOf(BANKS,c.banque)||"")}</span><strong>${eur(num(c.capitalRestant))} restant (${eur(num(c.mensualite))}/mois)</strong></div>
  `).join("") : `<div class="pr-row"><span>Aucun crédit renseigné</span><strong>—</strong></div>`;

  const biensHtml = s.biensImmo.length ? s.biensImmo.map(b=>`
    <div class="pr-row"><span>${esc(labelOf(STEPS[3].itemFields[0].options,b.type)||"Bien")} ${b.adresse?"— "+esc(b.adresse):""}${esc(ownerSuffix(b.proprietaire))}</span><strong>${eur(num(b.valeur))}</strong></div>
  `).join("") : `<div class="pr-row"><span>Aucun bien renseigné</span><strong>—</strong></div>`;

  const comptesHtml = s.comptesCourants.length ? s.comptesCourants.map(c=>`
    <div class="pr-row"><span>Compte ${esc(labelOf(COMPTE_COURANT_CONFIG.itemFields[2].options,c.typeCompte)||"courant")} — ${esc(labelOf(BANKS,c.banque)||"banque non renseignée")}${esc(ownerSuffix(c.proprietaire))}</span><strong>${eur(num(c.valeur))}</strong></div>
  `).join("") : `<div class="pr-row"><span>Aucun compte courant renseigné</span><strong>—</strong></div>`;

  const comptesTermeHtml = s.comptesTerme.length ? s.comptesTerme.map(c=>`
    <div class="pr-row"><span>Compte à terme — ${esc(labelOf(BANKS,c.banque)||"banque non renseignée")}${esc(ownerSuffix(c.proprietaire))}</span><strong>${eur(num(c.valeur))}</strong></div>
  `).join("") : "";

  const assurancesVieHtml = s.assurancesVie.length ? s.assurancesVie.map(c=>`
    <div class="pr-row"><span>Assurance-vie — ${esc(labelOf(BANKS,c.banque)||"banque non renseignée")}${esc(ownerSuffix(c.proprietaire))} (${esc(c.anneeOuverture||"—")})</span><strong>${eur(num(c.valeur))}</strong></div>
  `).join("") : "";

  const persHtml = s.pers.length ? s.pers.map(c=>`
    <div class="pr-row"><span>PER — ${esc(labelOf(BANKS,c.banque)||"banque non renseignée")}${esc(ownerSuffix(c.proprietaire))} (${esc(c.anneeOuverture||"—")})</span><strong>${eur(num(c.valeur))}</strong></div>
  `).join("") : "";

  const epargneSalarialeHtml = s.epargneSalariale.length ? s.epargneSalariale.map(c=>`
    <div class="pr-row"><span>${esc(c.typeSupport==="pee"?"PEE":c.typeSupport==="perco"?"PERCO":"Épargne salariale")} — ${esc(labelOf(BANKS,c.banque)||"banque non renseignée")}${esc(ownerSuffix(c.proprietaire))}</span><strong>${eur(num(c.valeur))}</strong></div>
  `).join("") : "";

  const epargneRows = [...EPARGNE_COURT_TERME, ...EPARGNE_LONG_TERME]
    .filter(x=>num(s.epargne[x.key].valeur)>0)
    .map(x=>pr(`${x.label} — ${labelOf(BANKS,s.epargne[x.key].banque)||"banque non renseignée"}${ownerSuffix(s.epargne[x.key].proprietaire)}`, eur(num(s.epargne[x.key].valeur))))
    .join("") + comptesTermeHtml + assurancesVieHtml + persHtml + epargneSalarialeHtml
    || pr("Aucun support renseigné","—");

  const actifsHtml = s.actifsPro.length ? s.actifsPro.map(a=>`
    <div class="pr-row"><span>${esc(a.societe||"Société")} (${esc(a.pourcentageDetention||0)}%)</span><strong>${eur(num(a.valeurEstimee))}</strong></div>
  `).join("") : `<div class="pr-row"><span>Aucun actif professionnel renseigné</span><strong>—</strong></div>`;

  const objectifsLabels = (s.objectifs||[]).map(v=>labelOf(STEPS[7].fields[0].options,v)).join(", ") || "—";
  const contratsPrevoyanceLabels = (s.prevoyanceContrats||[]).map(v=>labelOf(STEPS[6].fields[0].options,v)).join(", ") || "Aucun";
  const documentsJuridiquesLabels = (s.prevoyanceDocuments||[]).map(v=>labelOf(STEPS[6].fields[1].options,v)).join(", ") || "Aucun";

  function personneSection(label, p){
    return `
    <div class="pr-section">
      <h2>${esc(label)}</h2>
      ${pr("Nom", (p.prenom||"")+" "+(p.nom||""))}
      ${pr("Profession", p.profession)}
      ${pr("E-mail", p.email)}
      ${pr("Téléphone", p.telephone)}
      ${pr("Total revenus", eur(revenusTotal(p)))}
      ${pr("Total charges", eur(chargesTotal(p)))}
    </div>`;
  }
  const personneBSection = s.hasPersonneB ? personneSection("Seconde personne", s.personneB) : "";
  const personneCSection = s.hasPersonneC ? personneSection("Troisième personne", s.personneC) : "";

  const commentaireSection = (s.commentaireLibre && s.commentaireLibre.trim()) ? `
    <div class="pr-section"><h2>Commentaire du client</h2><div class="pr-row"><span>${esc(s.commentaireLibre.trim())}</span></div></div>` : "";

  document.getElementById("printReport").innerHTML = `
    <div class="pr-header">
      <div><h1>Lioncrest Capital</h1><span>Dossier d'analyse patrimoniale</span></div>
      <div style="text-align:right;">
        <div style="font-size:.78rem;">${esc(s.prenom)} ${esc(s.nom)}${s.hasPersonneB?" &amp; "+esc(s.personneB.prenom)+" "+esc(s.personneB.nom):""}${s.hasPersonneC?" &amp; "+esc(s.personneC.prenom)+" "+esc(s.personneC.nom):""}</div>
        <div style="font-size:.7rem;color:#8A93A0;">${date}</div>
      </div>
    </div>

    <div class="pr-section">
      <h2>État civil</h2>
      ${pr("Situation familiale", labelOf(SITUATION_OPTIONS, s.situationFamiliale))}
      ${pr("Profession", s.profession)}
      ${pr("E-mail", s.email)}
      ${pr("Téléphone", s.telephone)}
    </div>

    <div class="pr-section">
      <h2>Revenus et charges (annuels)</h2>
      ${pr("Total revenus", eur(revenusTotal(s)))}
      ${pr("Total charges", eur(chargesTotal(s)))}
    </div>

    ${personneBSection}
    ${personneCSection}

    <div class="pr-section"><h2>Crédits en cours</h2>${creditsHtml}</div>
    <div class="pr-section"><h2>Patrimoine immobilier</h2>${biensHtml}</div>
    <div class="pr-section"><h2>Comptes courants</h2>${comptesHtml}</div>
    <div class="pr-section"><h2>Patrimoine financier</h2>${epargneRows}</div>
    <div class="pr-section"><h2>Actifs professionnels</h2>${actifsHtml}</div>
    <div class="pr-section">
      <h2>Prévoyance et protection</h2>
      ${pr("Contrats de prévoyance", contratsPrevoyanceLabels)}
      ${pr("Documents juridiques existants", documentsJuridiquesLabels)}
    </div>
    <div class="pr-section"><h2>Objectifs patrimoniaux</h2><div class="pr-row"><span>${esc(objectifsLabels)}</span></div></div>
    <div class="pr-section">
      <h2>Profil investisseur</h2>
      ${pr("Appétence au risque", s.appetence)}
      ${pr("Horizon de placement", s.horizon)}
      ${pr("Expérience", s.experience)}
    </div>
    ${commentaireSection}

    <div class="pr-footer">
      Lioncrest Capital — anthony.felix@lioncrestcapital.com<br>
      Document confidentiel établi à partir des informations déclarées par le client. Il ne constitue pas un conseil personnalisé au sens réglementaire.
    </div>
  `;
}

function dossierFilename(){
  return "dossier-patrimonial-" + (state.nom || "lioncrest").toLowerCase().replace(/[^a-z0-9]+/g,"-") + ".pdf";
}

/* Rend #printReport en PDF et résout avec l'instance jsPDF (ne télécharge rien, ne touche pas l'UI) */
function renderReportPdf(opts){
  opts = opts || {};
  const scale = opts.scale || 2;
  const quality = opts.quality!==undefined ? opts.quality : 0.95;
  const reportEl = document.getElementById("printReport");

  if(typeof html2canvas === "undefined" || !window.jspdf){
    return Promise.reject(new Error("html2canvas ou jsPDF non chargés."));
  }

  return html2canvas(reportEl, {
    scale: scale,
    backgroundColor:"#ffffff",
    windowWidth: reportEl.scrollWidth,
    useCORS:true,
  }).then(function(canvas){
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({unit:"pt", format:"a4"});
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", quality);

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while(heightLeft > 0){
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf;
  });
}

function exportPdf(){
  renderPrintReportIntoDom();

  const btn = document.getElementById("btnDownloadPdf");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Génération du PDF...";

  renderReportPdf({scale:2, quality:0.95}).then(function(pdf){
    pdf.save(dossierFilename());
    btn.disabled = false;
    btn.textContent = originalLabel;
  }).catch(function(err){
    console.error("Erreur de génération du PDF :", err);
    btn.disabled = false;
    btn.textContent = "Échec — réessayer";
    setTimeout(()=>{ btn.textContent = originalLabel; }, 2500);
  });
}

})();
