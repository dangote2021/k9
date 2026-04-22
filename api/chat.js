// K9 — Claude API endpoint
// Handles chat with the K9 AI companion
// Requires env var: ANTHROPIC_API_KEY

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { message, history = [], dog = {}, lang = "fr", mode = "chat", goal = null, category = null } = body || {};
    if (!message) { res.status(400).json({ error: "Missing message" }); return; }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Graceful fallback so the UI keeps working before the env var is set
      res.status(200).json({
        reply: lang === "fr"
          ? "🔧 Claude n'est pas encore connecté sur ce déploiement. Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement Vercel et l'IA répondra en direct."
          : "🔧 Claude isn't connected on this deployment yet. Add ANTHROPIC_API_KEY to your Vercel environment variables and the AI will answer live.",
        mock: true,
        mode,
      });
      return;
    }

    // Build dog context
    const dogDesc = dog.name
      ? `${dog.name}, ${dog.breed || "chien"}, ${dog.age || "?"}, ${dog.weight || "?"} kg${dog.sex ? `, ${dog.sex === "f" ? "femelle" : "mâle"}` : ""}`
      : "chien inconnu";

    const chatSystem = lang === "fr"
      ? `Tu es "K9 Coach", le compagnon IA de l'application K9 pour les propriétaires de chiens francophones.

Tu t'adresses à un propriétaire de chien. Son chien : ${dogDesc}.

Tes domaines : santé, nutrition, éducation positive, comportement, bien-être canin. Tu donnes des conseils fondés sur la science et l'éducation bienveillante (renforcement positif, pas de dominance).

Règles :
- Ton chaleureux, direct, concret. Pas de jargon inutile.
- Réponses courtes : 3-6 phrases maximum, sauf si on te demande un plan détaillé.
- Évoque le chien par son nom quand c'est pertinent.
- Pour tout symptôme inquiétant, douleur, saignement, convulsion, intoxication suspectée : rappelle immédiatement de consulter un vétérinaire.
- Ne pose pas de diagnostic médical. Tu orientes.
- Si la question sort du cadre canin, recadre gentiment.
- Utilise du tutoiement.`
      : `You are "K9 Coach", the AI companion in the K9 app for English-speaking dog owners.

You talk to a dog owner. Their dog: ${dogDesc}.

Your domains: health, nutrition, positive training, behavior, canine wellbeing. Your advice is based on science and force-free training (positive reinforcement, no dominance).

Rules:
- Warm, direct, concrete tone. No unnecessary jargon.
- Short answers: 3-6 sentences max, unless a detailed plan is requested.
- Refer to the dog by name when relevant.
- For any worrying symptom, pain, bleeding, seizure, suspected poisoning: immediately advise contacting a vet.
- Do not make medical diagnoses. You guide.
- If the question is off-topic (non-canine), redirect gently.`;

    // PLAN MODE: structured 3-phase personalized plan
    const categoryLabel = category === "health" ? (lang === "fr" ? "santé" : "health") : (lang === "fr" ? "éducation" : "training");
    const planSystem = lang === "fr"
      ? `Tu es "K9 Coach", expert en ${categoryLabel} canine de l'application K9. Tu rédiges un plan personnalisé pour un propriétaire qui veut travailler un objectif précis avec son chien.

Chien : ${dogDesc}.
Objectif : ${goal || "à préciser"}.

Format de réponse OBLIGATOIRE :

**Pourquoi ça marche**
1-2 phrases expliquant la logique (science comportementale ou vétérinaire, jamais de dominance).

**Phase 1 — [nom de la phase] · [durée]**
• Étape 1 : …
• Étape 2 : …
• Étape 3 : …

**Phase 2 — [nom] · [durée]**
• …

**Phase 3 — [nom] · [durée]**
• …

**À éviter**
1-2 erreurs classiques.

**Quand consulter un pro**
Une phrase : dans quel cas appeler un éducateur canin comportementaliste (ou vétérinaire si volet santé).

Règles :
- Adapte précisément au profil : race, âge, poids, sexe.
- Sois concret : durée d'exercice, fréquence, indices (ex. "2× 5 min par jour").
- Renforcement positif uniquement.
- Tutoiement, ton chaleureux.
- Si santé : pas de diagnostic, oriente vers le véto pour tout symptôme sérieux.
- Max 350 mots.`
      : `You are "K9 Coach", a canine ${categoryLabel} expert in the K9 app. You're writing a personalized plan for an owner working on a specific goal with their dog.

Dog: ${dogDesc}.
Goal: ${goal || "to define"}.

REQUIRED response format:

**Why it works**
1-2 sentences explaining the logic (behavioral science or vet, never dominance).

**Phase 1 — [phase name] · [duration]**
• Step 1: …
• Step 2: …
• Step 3: …

**Phase 2 — [name] · [duration]**
• …

**Phase 3 — [name] · [duration]**
• …

**Avoid**
1-2 classic mistakes.

**When to consult a pro**
One sentence: when to call a behaviorist (or vet if health-related).

Rules:
- Adapt precisely to the profile: breed, age, weight, sex.
- Be concrete: exercise duration, frequency, cues (e.g., "2× 5 min per day").
- Force-free positive reinforcement only.
- Warm tone.
- If health: no diagnosis, refer to vet for any serious symptom.
- Max 350 words.`;

    const systemPrompt = mode === "plan" ? planSystem : chatSystem;

    // Shape messages for Anthropic API
    const messages = [];
    for (const turn of history.slice(-10)) {
      if (turn.role && turn.content) messages.push({ role: turn.role, content: turn.content });
    }
    messages.push({ role: "user", content: message });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: mode === "plan" ? 900 : 600,
        system: systemPrompt,
        messages,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Anthropic error:", resp.status, err);
      res.status(500).json({ error: "Upstream error", detail: err });
      return;
    }

    const data = await resp.json();
    const reply = data?.content?.[0]?.text || (lang === "fr" ? "Je n'ai pas pu répondre, réessaye." : "Couldn't reply, try again.");
    res.status(200).json({ reply, mode });
  } catch (e) {
    console.error("chat handler error:", e);
    res.status(500).json({ error: "Server error", detail: String(e && e.message || e) });
  }
}
