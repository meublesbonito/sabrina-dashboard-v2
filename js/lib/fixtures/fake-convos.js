// ─────────────────────────────────────────────
// FAKE CONVOS — Datasets de test pour Lot 4
// 7 cas couvrant tous les actionTypes + edge cases
// ─────────────────────────────────────────────

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

export const FAKE_CONVOS = [
  // ─── Cas 1 : CALL_NOW — téléphone client réel + intention achat ───
  {
    id: 'recCASE1',
    psid: 'psid_case1',
    customer_name: 'Marie Tremblay',
    fb_first_name: 'Marie',
    fb_last_name: 'Tremblay',
    customer_phone: null,
    context_preview: 'CLIENT: Je veux acheter ce sofa, mon numero est 514-555-1234 ||| BOT: Super! ||| CLIENT: Appelle-moi',
    last_message_time: minutesAgo(47),
    cart_value: 1200,
    confirmed_category: 'sofa',
    confirmed_budget: 1200,
    traite_status: null,
    sales_stage: 'NEGOTIATING'
  },
  
  // ─── Cas 2 : NUMÉRO MAGASIN dans contexte → doit être exclu ───
  // (pas de signal opportunity, donc finit en MESSENGER_FOLLOWUP avec phone=null si signal opp existait;
  //  ici sans signal, pas d'action générée — c'est le test qu'on filtre bien)
  {
    id: 'recCASE2',
    psid: 'psid_case2',
    customer_name: null,
    fb_first_name: 'Jean',
    fb_last_name: 'Bouchard',
    customer_phone: null,
    context_preview: 'BOT: Tu peux nous appeler au 438-337-3296 pour plus de détails ||| CLIENT: ok je vais regarder',
    last_message_time: minutesAgo(30),
    confirmed_category: 'matelas',
    traite_status: null
  },
  
  // ─── Cas 3 : FRUSTRATED — mot clé "pas satisfait" + sans signal ───
  {
    id: 'recCASE3',
    psid: 'psid_case3',
    customer_name: 'Claudette Roy',
    customer_phone: null,
    context_preview: 'CLIENT: Je suis pas satisfait du tout du service ||| BOT: Je comprends ||| CLIENT: Service mauvais',
    last_message_time: minutesAgo(15),
    cart_value: 650,
    confirmed_category: 'lit',
    traite_status: null
  },
  
  // ─── Cas 4 : BOT_BLOCKED — signal type:'broken' ───
  {
    id: 'recCASE4',
    psid: 'psid_case4',
    customer_name: 'Sophie Lavoie',
    customer_phone: null,
    context_preview: 'CLIENT: Je veux changer la taille ||| BOT: Quelle catégorie ? ||| CLIENT: J ai dit changer la taille ||| BOT: Quelle catégorie ?',
    last_message_time: minutesAgo(20),
    confirmed_category: 'matelas',
    traite_status: null
  },
  
  // ─── Cas 5 : ABANDONED_CART — carted + checkout_completed_at null ───
  {
    id: 'recCASE5',
    psid: 'psid_case5',
    customer_name: null,
    fb_first_name: 'Ahmed',
    fb_last_name: 'Benali',
    customer_phone: null,
    context_preview: 'CLIENT: Je vais voir et te confirmer ||| BOT: Parfait!',
    last_message_time: minutesAgo(125),
    cart_created_at: hoursAgo(2),
    checkout_completed_at: null,
    conversion_status: 'carted',
    cart_value: 450,
    confirmed_category: 'sofa',
    traite_status: null,
    sales_stage: 'ABANDONED'
  },
  
  // ─── Cas 6 : FOLLOWUP_DUE — called_no_answer + next_followup_at passé ───
  {
    id: 'recCASE6',
    psid: 'psid_case6',
    customer_name: 'Pierre Martin',
    customer_phone: '4385559876',
    context_preview: 'CLIENT: Rappelez-moi plus tard ||| BOT: Bien sur',
    last_message_time: hoursAgo(4),
    traite_status: 'called_no_answer',
    next_followup_at: minutesAgo(30), // passé de 30 min
    cart_value: 1500,
    confirmed_category: 'chambre'
  },
  
  // ─── Cas 7 : customer_phone = numéro magasin → doit être exclu ───
  // (avec signal opportunity → finit en MESSENGER_FOLLOWUP car phone=null après filter)
  {
    id: 'recCASE7',
    psid: 'psid_case7',
    customer_name: 'Test Magasin',
    customer_phone: '4383373296', // numéro magasin
    context_preview: 'CLIENT: Je veux acheter ce sofa ||| BOT: Super!',
    last_message_time: minutesAgo(10),
    cart_value: 800,
    confirmed_category: 'sofa',
    traite_status: null
  },
  
  // ─── Cas 8 : DÉJÀ TRAITÉ (converted) — DOIT être filtré ───
  {
    id: 'recCASE_DONE',
    psid: 'psid_done',
    customer_name: 'Déjà Converti',
    customer_phone: '4385551111',
    last_message_time: minutesAgo(10),
    traite_status: 'converted',
    cart_value: 2000
  }
];
