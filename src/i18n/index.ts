export type Language = "en" | "it";

// English is the default and is used inline in the code. This map provides
// the Italian translations for the optional "it" language setting.
const IT: Record<string, string> = {
  // --- settings ---
  "Language": "Lingua",
  "Interface language. English is the default. Some command names update after reloading Obsidian.":
    "Lingua dell'interfaccia. L'inglese è il default. Alcuni nomi dei comandi si aggiornano dopo il ricaricamento di Obsidian.",
  "Language changed. Reload Obsidian to apply it everywhere.":
    "Lingua cambiata. Ricarica Obsidian per applicarla ovunque.",
  "English": "Inglese",
  "Italian": "Italiano",
  "Binary path": "Percorso binario",
  "Convert documents with anydoc": "Converti i documenti con anydoc",
  "Anydoc binary path": "Percorso binario anydoc",
  "Command or full path to the anydoc executable (npm install -g @firecrawl/anydoc).":
    "Comando o percorso completo dell'eseguibile anydoc (npm install -g @firecrawl/anydoc).",
  "anydoc conversion failed": "Conversione anydoc fallita",
  "Command or full path to the opencode executable. Usually 'opencode' is enough if it is on your PATH.":
    "Comando o percorso completo dell'eseguibile opencode. Di solito basta 'opencode' se è nel PATH.",
  "Model": "Modello",
  "Agent": "Agent",
  "The opencode agent to use (e.g. build, plan). Leave empty for the default.":
    "Agente opencode da usare (es. build, plan). Lascia vuoto per il default.",
  "e.g. build": "es. build",
  "Session ID": "Session ID",
  "(automatic)": "(automatico)",
  "Reset session": "Azzera sessione",
  "Clear the saved session and start from scratch on the next message.":
    "Cancella la sessione salvata e riparte da zero al prossimo messaggio.",
  "Reset": "Azzera",
  "Session reset: the next message will start from a new session.":
    "Sessione azzerata: il prossimo messaggio partirà da una nuova sessione.",
  "Auto-approve permissions": "Auto-approve permessi",
  "Show reasoning": "Mostra ragionamento",
  "Show tool details": "Mostra dettagli degli strumenti",
  "Show the input and output of every tool executed during the request, in collapsible blocks.":
    "Mostra input e output di ogni strumento eseguito durante la richiesta, in blocchi apribili con un clic.",
  "Database self-cleanup": "Pulizia automatica del database",
  "Enable automatic cleanup": "Attiva pulizia automatica",
  "Periodically remove large file attachments from the opencode database (opencode.db), which would otherwise bloat it. Only file attachments older than the minimum age and larger than the max size are removed; conversation text is never touched.":
    "Rimuove periodicamente gli allegati file di grandi dimensioni dal database di opencode (opencode.db), che altrimenti si gonfia. Vengono rimossi solo gli allegati più vecchi dell'età minima e più grandi della dimensione massima; il testo delle conversazioni non viene mai toccato.",
  "Max part size (MB)": "Dimensione massima parte (MB)",
  "File attachments larger than this (in the database) are removed.":
    "Gli allegati file più grandi di questo valore (nel database) vengono rimossi.",
  "Minimum age (days)": "Età minima (giorni)",
  "Only attachments older than this are removed, so recent files stay available.":
    "Vengono rimossi solo gli allegati più vecchi di questo periodo, così i file recenti restano disponibili.",
  "Max attachment size (MB)": "Dimensione massima allegato (MB)",
  "When anydoc fails to convert a document, files larger than this are not attached to the request, to avoid storing unusable copies in the database.":
    "Quando anydoc non riesce a convertire un documento, i file più grandi di questo valore non vengono allegati alla richiesta, per evitare di salvare copie inutilizzabili nel database.",
  "Run cleanup now": "Esegui pulizia ora",
  "Remove oversized file attachments immediately, regardless of age.":
    "Rimuove subito gli allegati file troppo grandi, indipendentemente dall'età.",
  "Cleanup": "Pulisci",
  "Cleaning...": "Pulizia in corso...",
  "Cleanup done.": "Pulizia completata.",
  "Attachment skipped: the file is larger than $1 MB and could not be converted, so it was not attached.":
    "Allegato saltato: il file è più grande di $1 MB e non è stato possibile convertirlo, quindi non è stato allegato.",
  "Test connection": "Testa connessione",
  "Run 'opencode --version' to verify the binary is reachable.":
    "Esegue 'opencode --version' per verificare che il binario sia raggiungibile.",
  "Test": "Test",
  "Testing...": "Test in corso...",
  "Opencode found:": "Opencode trovato:",
  "Error:": "Errore:",
  "(default from opencode)": "(default di opencode)",
  "(custom)": "(personalizzato)",

  // --- main commands ---
  "New Vault Agents chat": "Nuova chat Vault Agents",
  "Open Vault Agents chat": "Apri chat Vault Agents",
  "Continue in a new session (by summarizing)": "Continua in una nuova sessione (riassumendo)",
  "Send selection to agent": "Invia selezione all'agente",
  "No text selected": "Nessun testo selezionato",
  "Use the current note as context": "Usa la nota corrente come contesto",
  "No active note": "Nessuna nota attiva",
  "Analyze the current note with agent": "Analizza la nota corrente con l'agente",
  "Analyze the content of the attached note below: provide a summary, key points, possible links with other vault notes and suggestions to develop it.":
    "Analizza il contenuto della nota allegata qui sotto: fornisci un riassunto, i punti chiave, eventuali collegamenti con altre note del vault e suggerimenti per svilupparla.",
  "Reset the active session": "Azzera la sessione attiva",
  "Session reset.": "Sessione azzerata.",

  // --- chat view ---
  "You": "Tu",
  "Opencode": "Opencode",
  "Vault Agents chat": "Chat Vault Agents",
  "Error": "Errore",
  "Copy text": "Copia testo",
  "Text copied.": "Testo copiato.",
  "Type a message for the agent... (Enter to send, Shift+Enter for a new line)":
    "Scrivi un messaggio per l'agente... (Invio per inviare, Shift+Invio per andare a capo)",
  "Hi! I am Vault Agents, connecting AI agents directly to your notes. Write a message below. Try the commands: / for commands, @ to attach a file, ! for quick actions.":
    "Ciao! Sono Vault Agents, il plugin che connette gli agenti AI direttamente alle tue note. Scrivi un messaggio qui sotto. Prova i comandi: / per le azioni, @ per allegare file, ! per azioni rapide.",
  "Send": "Invia",
  "Stop": "Stop",
  "New session": "Nuova sessione",
  "Rename session": "Rinomina sessione",
  "Delete session": "Elimina sessione",
  "Pin/Unpin session": "Fissa/Rimuovi la sessione",
  "Attach file": "Allega file",
  "Current note": "Nota corrente",
  "Remove the attached context": "Rimuovi il contesto allegato",
  "Session pinned.": "Sessione pinnata.",
  "Session unpinned.": "Sessione rimossa dai pinnati.",
  "Select a session to pin.": "Seleziona una sessione da pinnare.",
  "Select a session to rename.": "Seleziona una sessione da rinominare.",
  "Select a session to delete.": "Seleziona una sessione da eliminare.",
  "The title cannot be empty.": "Il titolo non può essere vuoto.",
  "Session renamed.": "Sessione rinominata.",
  "Session deleted.": "Sessione eliminata.",
  "Do you want to delete the session \"$1\"? The history saved in Obsidian will also be removed.":
    "Vuoi eliminare la sessione \"$1\"? Verrà rimossa anche la cronologia salvata in Obsidian.",
  "Delete": "Elimina",
  "Cancel": "Annulla",
  "Context:": "Contesto:",
  "last update $1s ago": "ultimo aggiornamento $1s fa",
  "Possibly stuck": "Possibilmente bloccato",
  "with context:": "con contesto:",
  "Note added to context.": "Nota aggiunta al contesto.",
  "Image attached: check that the selected model supports images (vision).":
    "Immagine allegata: verifica che il modello selezionato supporti le immagini (vision).",
  "New session: the next message will start from scratch.":
    "Nuova sessione: il prossimo messaggio partirà da zero.",
  "There is already a request in progress.": "C'è già una richiesta in corso.",
  "Select first the session to summarize.": "Seleziona prima la sessione da riassumere.",
  "Model set:": "Modello impostato:",
  "navigate": "navigare",
  "attach": "allegare",
  "close": "chiudere",
  "Search a vault file to attach...": "Cerca un file del vault da allegare...",
  "New title": "Nuovo titolo",
  "Save": "Salva",
  "Token usage and costs": "Utilizzo token e costi",
  "Loading...": "Caricamento...",
  "Last 5 hours": "Ultime 5 ore",
  "Last week": "Ultima settimana",
  "Last month": "Ultimo mese",
  "Input tokens": "Token input",
  "Output tokens": "Token output",
  "Total tokens": "Totale token",
  "Cost": "Costo",
  "Generating session summary...": "Generazione riassunto della sessione...",
  "The session summary could not be generated.": "Riassunto della sessione non riuscito.",
  "Starting...": "In avvio...",
  "Details": "Dettagli",
  "Reasoning": "Ragionamento",
  "Tool": "Strumento",
  "INPUT:": "INPUT:",
  "OUTPUT:": "OUTPUT:",
  "(no details)": "(nessun dettaglio)",
  "Token:": "Token:",
  "in": "in",
  "out": "out",
  "included": "incluso",
  "Cost:": "Costo:",
  "The selected model does not support images. Remove the attached image or choose a multimodal (vision) model from the Model menu.":
    "Il modello selezionato non supporta le immagini. Rimuovi l'allegato immagine oppure scegli un modello multimodale (con supporto vision) dal menu Modello.",
  "The saved session no longer exists: a new one will be created, resend the message.":
    "La sessione salvata non esiste più: ne verrà creata una nuova, rispedisci il messaggio.",
  "The agent process exited with code $1. Check the binary path and the model in the settings.":
    "Il processo dell'agente è terminato con codice $1. Verifica il percorso del binario e il modello nelle impostazioni.",
  "Session at the limit: new session created with the recent history.":
    "Sessione al limite: nuova sessione creata con la cronologia recente.",
  "New session created with the summary of the previous one.":
    "Nuova sessione creata con il riassunto della precedente.",
  "[SUMMARY OF THE PREVIOUS SESSION]": "[RIASSUNTO DELLA SESSIONE PRECEDENTE]",
  "[RECENT HISTORY OF THE PREVIOUS SESSION]": "[CRONOLOGIA RECENTE DELLA SESSIONE PRECEDENTE]",
  "Continue the work from here.": "Continua il lavoro da qui.",
  "Continue the work from the previous session.": "Continua il lavoro dalla sessione precedente.",
  "Continue the work from here, keeping the context above in mind.":
    "Continua il lavoro da qui, tenendo conto del contesto sopra.",
  "The previous session has no saved history. Continue the work from here.":
    "La sessione precedente non ha una cronologia salvata. Continua il lavoro da qui.",
  "User": "Utente",
  "Unknown error": "Errore sconosciuto",

  // --- suggestions ---
  "/model": "/modello",
  "Change the model": "Cambia il modello",
  "/new": "/nuova",
  "/note": "/nota",
  "Attach the current note": "Allega la nota corrente",
  "/attach": "/allega",
  "Attach a file": "Allega un file",
  "Token and cost statistics": "Statistiche token e costi",
  "/stats": "/statistiche",
  "/pin": "/fissa",
  "/rename": "/rinomina",
  "/prompt": "/prompt",
  "Insert a saved prompt": "Inserisci un prompt salvato",
  "Prompt templates": "Modelli di prompt",
  "Add prompt": "Aggiungi prompt",
  "Edit": "Modifica",
  "Prompt": "Prompt",
  "Prompt name": "Nome prompt",
  "Prompt text": "Testo prompt",
  "No saved prompts — add them in Settings": "Nessun prompt salvato — aggiungili nelle impostazioni",
  "The prompt cannot be empty.": "Il prompt non può essere vuoto.",
  "(untitled)": "(senza titolo)",
  "Attached": "Allegato",
  "current note": "nota corrente",
  "Attach the open note as context": "Allega la nota aperta come contesto",
  "attach file": "allega file",
  "Pick a file to attach": "Scegli un file da allegare",
  "new session": "nuova sessione",
  "Start from an empty session": "Parti da una sessione vuota",
  "statistics": "statistiche",
  "Tokens and costs (5h, week, month)": "Token e costi (5h, settimana, mese)",
  "pin/unpin session": "fissa/rimuovi sessione",
  "Pin the session in the list": "Fissa la sessione nella lista",
  "active model": "modello attivo",
  "Summarize in detail this conversation: goals, decisions made, work done, current state and next steps. Write the summary so the work can continue in a new session without losing context.":
    "Riassumi in dettaglio questa conversazione: obiettivi, decisioni prese, lavoro svolto, stato attuale e prossimi passi. Scrivi il riassunto in modo che si possa continuare il lavoro in una nuova sessione senza perdere il contesto.",

  // --- Antigravity & multi-engine ---
  "AI Engine": "Motore AI",
  "Select which AI backend to use. Antigravity connects directly to your Google AI Pro subscription with no API key needed.":
    "Seleziona quale backend AI usare. Antigravity si collega direttamente al tuo abbonamento Google AI Pro senza alcuna API key.",
  "Antigravity CLI (Google AI Pro)": "Antigravity CLI (Google AI Pro)",
  "OpenCode CLI": "OpenCode CLI",
  "Antigravity settings (Google AI Pro)": "Impostazioni Antigravity (Google AI Pro)",
  "OpenCode settings": "Impostazioni OpenCode",
  "General settings": "Impostazioni generali",
  "Document conversion": "Conversione documenti",
  "Antigravity binary path": "Percorso binario Antigravity",
  "Command or full path to the agy executable. Default is 'agy' or '~/.local/bin/agy'.":
    "Comando o percorso completo dell'eseguibile agy. Il default è 'agy' o '~/.local/bin/agy'.",
  "Pick a model from Antigravity (Gemini 3.8 Flash, Claude Opus/Sonnet 5.5). The effort is part of the model name. Included with Google AI Pro.":
    "Scegli un modello da Antigravity (Gemini 3.8 Flash, Claude Opus/Sonnet 5.5). L'effort fa parte del nome del modello. Incluso con Google AI Pro.",
  "Pick a model from the opencode list. Default uses the OpenCode Go provider.":
    "Scegli un modello dall'elenco opencode. Il default usa il provider OpenCode Go.",
  "Reasoning effort": "Livello di ragionamento (Effort)",
  "Effort sent only for models whose name does not already include it. Antigravity model names usually end with -low/-medium/-high.":
    "Effort inviato solo per i modelli il cui nome non lo include già. I nomi dei modelli Antigravity di solito terminano con -low/-medium/-high.",
  "Low": "Basso",
  "Medium": "Medio",
  "High": "Alto",
  "Extra high": "Extra alto",
  "Max": "Massimo",
  "Antigravity found:": "Antigravity trovato:",
  "Run 'agy --version' to verify the binary is reachable.":
    "Esegue 'agy --version' per verificare che il binario sia raggiungibile.",
  "Automatically allow tool permissions (bash, file edits, etc.). Turn it off for extra safety.":
    "Concede automaticamente i permessi degli strumenti (bash, edit file, ecc.). Disattivalo per maggiore sicurezza.",
  "Show the model's reasoning blocks.": "Mostra i blocchi di ragionamento del modello.",
  "The persistent session id used for the chat. Managed automatically. Empty = new session on next message.":
    "L'ID di sessione persistente usato per la chat. Gestito automaticamente. Vuoto = nuova sessione al prossimo messaggio.",
  "Run anydoc on attached documents (PDF, Word, Excel, etc.) and attach them as Markdown instead of the original file.":
    "Esegue anydoc sui documenti allegati (PDF, Word, Excel, ecc.) e li allega come Markdown anziché il file originale.",
  "Save reusable prompt templates. In the chat, type /prompt to quickly insert them into the composer.":
    "Salva modelli di prompt riutilizzabili. Nella chat, digita /prompt per inserirli rapidamente nel compositore.",
  "Included with $1 ($0.00)": "Incluso con $1 ($0.00)",
  "Included ($0.00)": "Incluso ($0.00)",
  "Search models... (e.g. gemini, claude, flash, deepseek)":
    "Cerca modelli... (es. gemini, claude, flash, deepseek)",
  "select": "seleziona",
};

export function translate(lang: Language, text: string): string {
  if (lang === "it") return IT[text] ?? text;
  return text;
}

export function substitute(template: string, ...args: (string | number)[]): string {
  return template.replace(/\$(\d+)/g, (_, n) => String(args[Number(n) - 1] ?? ""));
}
