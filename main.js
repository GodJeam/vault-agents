var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, {
  enumerable: true, configurable: true, writable: true, value }) : obj[key] =
    value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc =
          __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", {
  value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj,
  typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => OpencodePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");

// src/features/chat/view.ts
var import_obsidian6 = require("obsidian");

// src/i18n/index.ts
var IT = {
  // --- settings ---
  "Language": "Lingua",
  [
    "Interface language. English is the default. Some command names update " +
    "after reloading Obsidian."]: 
    "Lingua dell'interfaccia. L'inglese \xE8 il default. Alcuni nomi dei " +
    "comandi si aggiornano dopo il ricaricamento di Obsidian.",
    "Language changed. Reload Obsidian to apply it everywhere.": 
    "Lingua cambiata. Ricarica Obsidian per applicarla ovunque.",
  "English": "Inglese",
  "Italian": "Italiano",
  "Binary path": "Percorso binario",
  "Convert documents with anydoc": "Converti i documenti con anydoc",
  "Anydoc binary path": "Percorso binario anydoc",
  [
    "Command or full path to the anydoc executable (npm install -g " +
    "@firecrawl/anydoc)."]: 
    "Comando o percorso completo dell'eseguibile anydoc (npm install -g " +
    "@firecrawl/anydoc).",
  "anydoc conversion failed": "Conversione anydoc fallita",
  [
    "Command or full path to the opencode executable. Usually 'opencode' " +
    "is enough if it is on your PATH."]: 
    "Comando o percorso completo dell'eseguibile opencode. Di solito basta " +
    "'opencode' se \xE8 nel PATH.",
  "Model": "Modello",
  "Agent": "Agent",
  [
    "The opencode agent to use (e.g. build, plan). Leave empty for the " +
    "default."
  ]: 
    "Agente opencode da usare (es. build, plan). Lascia vuoto per il " +
    "default.",
  "e.g. build": "es. build",
  "Session ID": "Session ID",
  "(automatic)": "(automatico)",
  "Reset session": "Azzera sessione",
    "Clear the saved session and start from scratch on the next message.": 
    "Cancella la sessione salvata e riparte da zero al prossimo messaggio.",
  "Reset": "Azzera",
    "Session reset: the next message will start from a new session.": 
    "Sessione azzerata: il prossimo messaggio partir\xE0 da una nuova " +
    "sessione.",
  "Auto-approve permissions": "Auto-approve permessi",
  "Show reasoning": "Mostra ragionamento",
  "Show tool details": "Mostra dettagli degli strumenti",
  [
    "Show the input and output of every tool executed during the request, " +
    "in collapsible blocks."]: 
    "Mostra input e output di ogni strumento eseguito durante la richiesta," +
    " in blocchi apribili con un clic.",
  "Database self-cleanup": "Pulizia automatica del database",
  "Enable automatic cleanup": "Attiva pulizia automatica",
  [
    "Periodically remove large file attachments from the opencode database " +
    "(opencode.db), which would otherwise bloat it. Only file attachments " +
    "older than the minimum age and larger than the max size are removed; " +
    "conversation text is never touched."]: 
    "Rimuove periodicamente gli allegati file di grandi dimensioni dal " +
    "database di opencode (opencode.db), che altrimenti si gonfia. Vengono " +
    "rimossi solo gli allegati pi\xF9 vecchi dell'et\xE0 minima e pi\xF9 " +
    "grandi della dimensione massima; il testo delle conversazioni non " +
    "viene mai toccato.",
  "Max part size (MB)": "Dimensione massima parte (MB)",
    "File attachments larger than this (in the database) are removed.": 
    "Gli allegati file pi\xF9 grandi di questo valore (nel database) " +
    "vengono rimossi.",
  "Minimum age (days)": "Et\xE0 minima (giorni)",
  [
    "Only attachments older than this are removed, so recent files stay " +
    "available."]: 
    "Vengono rimossi solo gli allegati pi\xF9 vecchi di questo periodo, " +
    "cos\xEC i file recenti restano disponibili.",
  "Max attachment size (MB)": "Dimensione massima allegato (MB)",
  [
    "When anydoc fails to convert a document, files larger than this are " +
    "not attached to the request, to avoid storing unusable copies in the " +
    "database."]: 
    "Quando anydoc non riesce a convertire un documento, i file pi\xF9 " +
    "grandi di questo valore non vengono allegati alla richiesta, per " +
    "evitare di salvare copie inutilizzabili nel database.",
  "Run cleanup now": "Esegui pulizia ora",
    "Remove oversized file attachments immediately, regardless of age.": 
    "Rimuove subito gli allegati file troppo grandi, indipendentemente " +
    "dall'et\xE0.",
  "Cleanup": "Pulisci",
  "Cleaning...": "Pulizia in corso...",
  "Cleanup done.": "Pulizia completata.",
  [
    "Attachment skipped: the file is larger than $1 MB and could not be " +
    "converted, so it was not attached."]: 
    "Allegato saltato: il file \xE8 pi\xF9 grande di $1 MB e non \xE8 " +
    "stato possibile convertirlo, quindi non \xE8 stato allegato.",
  "Test connection": "Testa connessione",
    "Run 'opencode --version' to verify the binary is reachable.": 
    "Esegue 'opencode --version' per verificare che il binario sia " +
    "raggiungibile.",
  "Test": "Test",
  "Testing...": "Test in corso...",
  "Opencode found:": "Opencode trovato:",
  "Error:": "Errore:",
  "(default from opencode)": "(default di opencode)",
  "(custom)": "(personalizzato)",
  // --- main commands ---
  "New Vault Agents chat": "Nuova chat Vault Agents",
  "Open Vault Agents chat": "Apri chat Vault Agents",
    "Continue in a new session (by summarizing)": 
    "Continua in una nuova sessione (riassumendo)",
  "Send selection to agent": "Invia selezione all'agente",
  "No text selected": "Nessun testo selezionato",
  "Use the current note as context": "Usa la nota corrente come contesto",
  "No active note": "Nessuna nota attiva",
  "Analyze the current note with agent":
    "Analizza la nota corrente con l'agente",
  [
    "Analyze the content of the attached note below: provide a summary, " +
    "key points, possible links with other vault notes and suggestions to " +
    "develop it."]: 
    "Analizza il contenuto della nota allegata qui sotto: fornisci un " +
    "riassunto, i punti chiave, eventuali collegamenti con altre note del " +
    "vault e suggerimenti per svilupparla.",
  "Reset the active session": "Azzera la sessione attiva",
  "Session reset.": "Sessione azzerata.",
  // --- chat view ---
  "You": "Tu",
  "Opencode": "Opencode",
  "Vault Agents chat": "Chat Vault Agents",
  "Error": "Errore",
  "Copy text": "Copia testo",
  "Text copied.": "Testo copiato.",
  [
    "Type a message for the agent... (Enter to send, Shift+Enter for a new " +
    "line)"]: 
    "Scrivi un messaggio per l'agente... (Invio per inviare, Shift+Invio " +
    "per andare a capo)",
  [
    "Hi! I am Vault Agents, connecting AI agents directly to your notes. " +
    "Write a message below. Try the commands: / for commands, @ to attach " +
    "a file, ! for quick actions."]: 
    "Ciao! Sono Vault Agents, il plugin che connette gli agenti AI " +
    "direttamente alle tue note. Scrivi un messaggio qui sotto. Prova i " +
    "comandi: / per le azioni, @ per allegare file, ! per azioni rapide.",
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
  "The title cannot be empty.": "Il titolo non pu\xF2 essere vuoto.",
  "Session renamed.": "Sessione rinominata.",
  "Session deleted.": "Sessione eliminata.",
  [
    'Do you want to delete the session "$1"? The history saved in Obsidian ' +
    'will also be removed.']: 
    'Vuoi eliminare la sessione "$1"? Verr\xE0 rimossa anche la cronologia ' +
    'salvata in Obsidian.',
  "Delete": "Elimina",
  "Cancel": "Annulla",
  "Context:": "Contesto:",
  "last update $1s ago": "ultimo aggiornamento $1s fa",
  "Possibly stuck": "Possibilmente bloccato",
  "with context:": "con contesto:",
  "Note added to context.": "Nota aggiunta al contesto.",
  [
    "Image attached: check that the selected model supports images " +
    "(vision)."
  ]: 
    "Immagine allegata: verifica che il modello selezionato supporti le " +
    "immagini (vision).",
    "New session: the next message will start from scratch.": 
    "Nuova sessione: il prossimo messaggio partir\xE0 da zero.",
  "There is already a request in progress.":
    "C'\xE8 gi\xE0 una richiesta in corso.",
  "Select first the session to summarize.": 
    "Seleziona prima la sessione da riassumere.",
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
    "The session summary could not be generated.":
      "Riassunto della sessione non riuscito.",
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
  [
    "The selected model does not support images. Remove the attached image " +
    "or choose a multimodal (vision) model from the Model menu."]: 
    "Il modello selezionato non supporta le immagini. Rimuovi l'allegato " +
    "immagine oppure scegli un modello multimodale (con supporto vision) " +
    "dal menu Modello.",
  [
    "The saved session no longer exists: a new one will be created, resend " +
    "the message."]: 
    "La sessione salvata non esiste pi\xF9: ne verr\xE0 creata una nuova, " +
    "rispedisci il messaggio.",
  [
    "The agent process exited with code $1. Check the binary path and the " +
    "model in the settings."]: 
    "Il processo dell'agente \xE8 terminato con codice $1. Verifica il " +
    "percorso del binario e il modello nelle impostazioni.",
    "Session at the limit: new session created with the recent history.": 
    "Sessione al limite: nuova sessione creata con la cronologia recente.",
    "New session created with the summary of the previous one.": 
    "Nuova sessione creata con il riassunto della precedente.",
  "[SUMMARY OF THE PREVIOUS SESSION]": "[RIASSUNTO DELLA SESSIONE PRECEDENTE]",
  "[RECENT HISTORY OF THE PREVIOUS SESSION]": 
    "[CRONOLOGIA RECENTE DELLA SESSIONE PRECEDENTE]",
  "Continue the work from here.": "Continua il lavoro da qui.",
    "Continue the work from the previous session.": 
    "Continua il lavoro dalla sessione precedente.",
    "Continue the work from here, keeping the context above in mind.": 
    "Continua il lavoro da qui, tenendo conto del contesto sopra.",
  [
    "The previous session has no saved history. Continue the work from " +
    "here."
  ]: 
    "La sessione precedente non ha una cronologia salvata. Continua il " +
    "lavoro da qui.",
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
    "No saved prompts \u2014 add them in Settings": 
    "Nessun prompt salvato \u2014 aggiungili nelle impostazioni",
  "The prompt cannot be empty.": "Il prompt non pu\xF2 essere vuoto.",
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
  [
    "Summarize in detail this conversation: goals, decisions made, work " +
    "done, current state and next steps. Write the summary so the work can " +
    "continue in a new session without losing context."]: 
    "Riassumi in dettaglio questa conversazione: obiettivi, decisioni " +
    "prese, lavoro svolto, stato attuale e prossimi passi. Scrivi il " +
    "riassunto in modo che si possa continuare il lavoro in una nuova " +
    "sessione senza perdere il contesto.",
  // --- Antigravity & multi-engine ---
  "AI Engine": "Motore AI",
  [
    "Select which AI backend to use. Antigravity connects directly to your " +
    "Google AI Pro subscription with no API key needed."]: 
    "Seleziona quale backend AI usare. Antigravity si collega direttamente " +
    "al tuo abbonamento Google AI Pro senza alcuna API key.",
  "Antigravity CLI (Google AI Pro)": "Antigravity CLI (Google AI Pro)",
  "OpenCode CLI": "OpenCode CLI",
  "Antigravity settings (Google AI Pro)":
    "Impostazioni Antigravity (Google AI Pro)",
  "OpenCode settings": "Impostazioni OpenCode",
  "General settings": "Impostazioni generali",
  "Document conversion": "Conversione documenti",
  "Antigravity binary path": "Percorso binario Antigravity",
  [
    "Command or full path to the agy executable. Default is 'agy' or '~/." +
    "local/bin/agy'."]: 
    "Comando o percorso completo dell'eseguibile agy. Il default \xE8 " +
    "'agy' o '~/.local/bin/agy'.",
  [
    "Pick a model from Antigravity (Gemini 3.8 Flash, Claude Opus/Sonnet 5." +
    "5). The effort is part of the model name. Included with Google AI Pro."]: 
    "Scegli un modello da Antigravity (Gemini 3.8 Flash, Claude Opus/" +
    "Sonnet 5.5). L'effort fa parte del nome del modello. Incluso con " +
    "Google AI Pro.",
  [
    "Pick a model from the opencode list. Default uses the OpenCode Go " +
    "provider."]: 
    "Scegli un modello dall'elenco opencode. Il default usa il provider " +
    "OpenCode Go.",
  "Reasoning effort": "Livello di ragionamento (Effort)",
  [
    "Effort sent only for models whose name does not already include it. " +
    "Antigravity model names usually end with -low/-medium/-high."]: 
    "Effort inviato solo per i modelli il cui nome non lo include gi\xE0. " +
    "I nomi dei modelli Antigravity di solito terminano con -low/-medium/-" +
    "high.",
  "Low": "Basso",
  "Medium": "Medio",
  "High": "Alto",
  "Extra high": "Extra alto",
  "Max": "Massimo",
  "Antigravity found:": "Antigravity trovato:",
    "Run 'agy --version' to verify the binary is reachable.": 
    "Esegue 'agy --version' per verificare che il binario sia " +
    "raggiungibile.",
  [
    "Automatically allow tool permissions (bash, file edits, etc.). Turn " +
    "it off for extra safety."]: 
    "Concede automaticamente i permessi degli strumenti (bash, edit file, " +
    "ecc.). Disattivalo per maggiore sicurezza.",
  "Show the model's reasoning blocks.": 
    "Mostra i blocchi di ragionamento del modello.",
  [
    "The persistent session id used for the chat. Managed automatically. " +
    "Empty = new session on next message."]: 
    "L'ID di sessione persistente usato per la chat. Gestito " +
    "automaticamente. Vuoto = nuova sessione al prossimo messaggio.",
  [
    "Run anydoc on attached documents (PDF, Word, Excel, etc.) and attach " +
    "them as Markdown instead of the original file."]: 
    "Esegue anydoc sui documenti allegati (PDF, Word, Excel, ecc.) e li " +
    "allega come Markdown anzich\xE9 il file originale.",
  [
    "Save reusable prompt templates. In the chat, type /prompt to quickly " +
    "insert them into the composer."]: 
    "Salva modelli di prompt riutilizzabili. Nella chat, digita /prompt " +
    "per inserirli rapidamente nel compositore.",
  "Included with $1 ($0.00)": "Incluso con $1 ($0.00)",
  "Included ($0.00)": "Incluso ($0.00)",
    "Search models... (e.g. gemini, claude, flash, deepseek)": 
    "Cerca modelli... (es. gemini, claude, flash, deepseek)",
  "select": "seleziona",
  // --- live activity, human-friendly tools & interactive questions ---
  "Read file": "Lettura file",
  "Write file": "Scrittura file",
  "Edit file": "Modifica file",
  "Run command": "Esecuzione comando",
  "Search text": "Ricerca nel testo",
  "Find files": "Ricerca file",
  "List folder": "Esplorazione cartella",
  "Web search": "Ricerca web",
  "Task list": "Lista attivit\xE0",
  "Subagent": "Sotto-agente",
  "Question": "Domanda",
  "tasks": "attivit\xE0",
  "done": "completate",
  "Connecting to agent...": "Connessione all'agente in corso...",
  "Thinking...": "Ragionamento in corso...",
  "Analyzing and planning...": "Analisi e pianificazione in corso...",
  "Writing response...": "Scrittura della risposta...",
  "Running: $1": "In esecuzione: $1",
  "Waiting for your answer...": "In attesa della tua risposta...",
  "Working...": "Elaborazione in corso...",
  "Agent question": "Domanda dall'agente",
  "Select one or more options": "Seleziona una o pi\xF9 opzioni",
  "Select an option": "Seleziona un'opzione",
  "Other / custom answer...": "Altro / risposta personalizzata...",
  "Send answer": "Invia risposta",
  "Answer sent": "Risposta inviata",
    "Please select or type an answer before sending.": 
    "Seleziona o scrivi almeno una risposta prima di inviare.",
  "Here are my answers to your questions:":
    "Ecco le mie risposte alle tue domande:"
};
function translate(lang, text) {
  var _a;
  if (lang === "it") return (_a = IT[text]) != null ? _a : text;
  return text;
}
function substitute(template, ...args) {
  return template.replace(
    /\$(\d+)/g,
    (_, n) => {
      var _a;
      return String((_a = args[Number(n) - 1]) != null ? _a : "");
    }
  );
}

// src/shared/modals.ts
var import_obsidian = require("obsidian");
var RenameModal = class extends import_obsidian.Modal {
  constructor(app, plugin, current, onSubmit) {
    super(app);
    this.plugin = plugin;
    this.current = current;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    const t = (s) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: t("Rename session") });
    let input;
    new import_obsidian.Setting(contentEl).setName(t("New title")).addText((
      txt) => {
      input = txt.inputEl;
      txt.setValue(this.current);
      txt.inputEl.select();
    });
    new import_obsidian.Setting(contentEl).addButton(
      (b) => b.setButtonText(t("Save")).setCta().onClick(() => {
        if (!input) return;
        const v = input.value.trim();
        if (!v) {
          new import_obsidian.Notice(t("The title cannot be empty."));
          return;
        }
        this.onSubmit(v);
        this.close();
      })
    ).addButton(
      (b) => b.setButtonText(t("Cancel")).onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var StatsModal = class extends import_obsidian.Modal {
  constructor(app, plugin, engine) {
    super(app);
    this.plugin = plugin;
    this.engine = engine;
  }
  onOpen() {
    const { contentEl } = this;
    const t = (s) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: t("Token usage and costs") });
    const status = contentEl.createDiv({
      cls: "opencode-stats-loading",
      text: t("Loading...")
    });
    this.plugin.registry.resolveProvider(this.engine).getUsageStats().then((
      s) => {
      status.remove();
      this.renderWindow(contentEl, t("Last 5 hours"), s.h5);
      this.renderWindow(contentEl, t("Last week"), s.week);
      this.renderWindow(contentEl, t("Last month"), s.month);
    }).catch((e) => {
      status.setText(`${t("Error:")} ${e.message}`);
    });
  }
  renderWindow(container, label, w) {
    var _a;
    const locale = this.plugin.settings.language === "it" ? "it-IT" : "en-US";
    const t = (s) => this.plugin.t(s);
    container.createEl("h4", { text: label });
    new import_obsidian.Setting(container).setName(t("Input tokens")).setDesc(w
      .input.toLocaleString(locale));
    new import_obsidian.Setting(container).setName(t("Output tokens")).setDesc(w
      .output.toLocaleString(locale));
    new import_obsidian.Setting(container).setName(t("Total tokens")).setDesc((w
      .input + w.output).toLocaleString(locale));
    const provider = this.plugin.registry.resolveProvider(this.engine);
    const incKey = provider.costNote ? t("Included with $1 ($0.00)") : t(
      "Included ($0.00)");
    const costDesc = provider.included ? substitute(incKey, (_a = provider
      .costNote) != null ? _a : "") : `${w.cost.toFixed(4)} $`;
    new import_obsidian.Setting(container).setName(t("Cost")).setDesc(costDesc);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ConfirmModal = class extends import_obsidian.Modal {
  constructor(app, plugin, title, message, confirmLabel, onConfirm) {
    super(app);
    this.plugin = plugin;
    this.title = title;
    this.message = message;
    this.confirmLabel = confirmLabel;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const { contentEl } = this;
    const t = (s) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: this.title });
    contentEl.createDiv({
      cls: "opencode-confirm-message",
      text: this.message
    });
    new import_obsidian.Setting(contentEl).addButton(
      (b) => b.setButtonText(this.confirmLabel).setWarning().onClick(() => {
        this.onConfirm();
        this.close();
      })
    ).addButton(
      (b) => b.setButtonText(t("Cancel")).onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PromptModal = class extends import_obsidian.Modal {
  constructor(app, plugin, initialName, initialText, onSave) {
    super(app);
    this.plugin = plugin;
    this.initialName = initialName;
    this.initialText = initialText;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    const t = (s) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: t("Prompt") });
    let nameInput;
    let textArea;
    new import_obsidian.Setting(contentEl).setName(t("Prompt name")).addText((
      x) => {
      nameInput = x.inputEl;
      x.setValue(this.initialName);
    });
    new import_obsidian.Setting(contentEl).setName(t("Prompt text"))
      .addTextArea((x) => {
      textArea = x.inputEl;
      x.setValue(this.initialText);
      x.inputEl.rows = 10;
    });
    new import_obsidian.Setting(contentEl).addButton(
      (b) => b.setButtonText(t("Save")).setCta().onClick(() => {
        if (!nameInput || !textArea) return;
        const name = nameInput.value.trim();
        const text = textArea.value;
        if (!name || !text) {
          new import_obsidian.Notice(t("The prompt cannot be empty."));
          return;
        }
        this.onSave(name, text);
        this.close();
      })
    ).addButton(
      (b) => b.setButtonText(t("Cancel")).onClick(() => this.close())
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var FileSuggestModal = class extends import_obsidian.SuggestModal {
  constructor(app, plugin, onPick) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
    __publicField(this, "items", null);
    const t = (s) => this.plugin.t(s);
    this.setPlaceholder(t("Search a vault file to attach..."));
    this.setInstructions([
      { command: "\u2191\u2193", purpose: t("navigate") },
      { command: "\u21B5", purpose: t("attach") },
      { command: "esc", purpose: t("close") }
    ]);
  }
  getItems() {
    if (!this.items) {
      this.items = this.app.vault.getFiles().sort((a, b) => a.path
        .localeCompare(b.path));
    }
    return this.items;
  }
  getSuggestions(query) {
    const q = query.trim().toLowerCase();
    const items = this.getItems();
    if (!q) return items.slice(0, 50);
    return items.filter((f) => f.path.toLowerCase().includes(q)).slice(0, 50);
  }
  renderSuggestion(file, el) {
    el.createEl("div", { text: file.path });
  }
  onChooseSuggestion(file) {
    this.onPick(file);
  }
};
var ModelSuggestModal = class extends import_obsidian.SuggestModal {
  constructor(app, plugin, items, onPick) {
    super(app);
    this.plugin = plugin;
    this.items = items;
    this.onPick = onPick;
    const t = (s) => this.plugin.t(s);
    this.setPlaceholder(
      t("Search models... (e.g. gemini, claude, flash, deepseek)")
    );
    this.setInstructions([
      { command: "\u2191\u2193", purpose: t("navigate") },
      { command: "\u21B5", purpose: t("select") },
      { command: "esc", purpose: t("close") }
    ]);
  }
  getItems() {
    return this.items;
  }
  getSuggestions(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      return this.items.slice(0, 30);
    }
    const filtered = this.items.filter(
      (item) => item.id.toLowerCase().includes(q) || item.provider.toLowerCase()
        .includes(q) || item.engine.toLowerCase().includes(q)
    );
    return filtered.slice(0, 30);
  }
  renderSuggestion(item, el) {
    el.addClass("opencode-model-suggest-item");
    const titleEl = el.createDiv({ cls: "opencode-model-suggest-title" });
    titleEl.createSpan({ text: item.id, cls: "opencode-model-suggest-name" });
    if (item.isActive) {
      titleEl.createSpan({ text: "  \u2713",
        cls: "opencode-model-suggest-check" });
    }
    const activeSuffix = item.isActive ?
      ` \xB7 ${this.plugin.t("active model")}` : "";
    const descCls =
      `opencode-model-suggest-desc opencode-model-suggest-desc--${item.engine}`;
    el.createDiv({
      cls: descCls,
      text: item.provider + activeSuffix
    });
  }
  onChooseSuggestion(item) {
    this.onPick(item);
  }
};

// src/features/chat/messageBubble.ts
var import_obsidian4 = require("obsidian");

// src/features/chat/stepWidget.ts
var import_obsidian2 = require("obsidian");
var TOOL_PRESENTATION_MAP = {
  read: { labelKey: "Read file", icon: "file-text" },
  view_file: { labelKey: "Read file", icon: "file-text" },
  read_file: { labelKey: "Read file", icon: "file-text" },
  write: { labelKey: "Write file", icon: "file-plus" },
  write_to_file: { labelKey: "Write file", icon: "file-plus" },
  write_file: { labelKey: "Write file", icon: "file-plus" },
  edit: { labelKey: "Edit file", icon: "file-edit" },
  edit_file: { labelKey: "Edit file", icon: "file-edit" },
  replace_file_content: { labelKey: "Edit file", icon: "file-edit" },
  multi_replace_file_content: { labelKey: "Edit file", icon: "file-edit" },
  bash: { labelKey: "Run command", icon: "terminal" },
  run_command: { labelKey: "Run command", icon: "terminal" },
  grep: { labelKey: "Search text", icon: "search" },
  grep_search: { labelKey: "Search text", icon: "search" },
  glob: { labelKey: "Find files", icon: "folder-search" },
  find_by_name: { labelKey: "Find files", icon: "folder-search" },
  list_dir: { labelKey: "List folder", icon: "folder" },
  webfetch: { labelKey: "Web search", icon: "globe" },
  search_web: { labelKey: "Web search", icon: "globe" },
  read_url_content: { labelKey: "Web search", icon: "globe" },
  todowrite: { labelKey: "Task list", icon: "list-todo" },
  task: { labelKey: "Subagent", icon: "bot" },
  invoke_subagent: { labelKey: "Subagent", icon: "bot" },
  question: { labelKey: "Question", icon: "help-circle" },
  ask_question: { labelKey: "Question", icon: "help-circle" }
};
function formatToolAction(tool, rawTitle, t) {
  const key = (tool || "").toLowerCase();
  const mapped = TOOL_PRESENTATION_MAP[key];
  const label = mapped ? t(mapped.labelKey) : tool || t("Tool");
  const icon = mapped ? mapped.icon : "wrench";
  const cleanTitle = (rawTitle || "").trim();
  const isDuplicate = !cleanTitle || cleanTitle.toLowerCase() === key ||
    cleanTitle.toLowerCase() === label.toLowerCase();
  const target = isDuplicate ? "" : cleanTitle.length > 110 ? cleanTitle.slice(
    0, 107) + "\u2026" : cleanTitle;
  return { label, target, icon };
}
var StepManager = class {
  constructor(containerEl, t, showIO, onScrollRequest) {
    this.containerEl = containerEl;
    this.t = t;
    this.showIO = showIO;
    this.onScrollRequest = onScrollRequest;
    __publicField(this, "steps", /* @__PURE__ */ new Map());
  }
  addStep(step) {
    const existing = this.steps.get(step.id);
    if (step.state === "running") {
      if (existing) return;
      const row = this.containerEl.createDiv({
        cls: "opencode-step opencode-step--running"
      });
      const icon = row.createSpan({ cls: "opencode-step-icon" });
      icon.createDiv({ cls: "opencode-step-spinner" });
      const main = row.createDiv({ cls: "opencode-step-main" });
      const header = main.createDiv({ cls: "opencode-step-header" });
      const titleEl = header.createDiv({ cls: "opencode-step-title" });
      const durationEl = header.createSpan({
        cls: "opencode-step-duration hidden"
      });
      this.renderStepTitle(titleEl, step);
      this.renderTodoPreview(main, step);
      if (this.showIO) this.buildStepDetails(main, step);
      this.steps.set(step.id, {
        row,
        icon,
        main,
        titleEl,
        durationEl,
        status: "running"
      });
      this.onScrollRequest();
      return;
    }
    const rec = existing;
    const isErr = step.state === "error";
    const { icon: toolIcon } = formatToolAction(step.tool, step.title, this.t);
    const doneCls = isErr ? "opencode-step--error" : "opencode-step--done";
    if (rec) {
      rec.status = step.state;
      rec.row.removeClass("opencode-step--running");
      rec.row.addClass(doneCls);
      rec.icon.empty();
      (0, import_obsidian2.setIcon)(rec.icon, isErr ? "x" : toolIcon);
      this.renderStepTitle(rec.titleEl, step);
      this.updateDuration(rec.durationEl, step.durationMs);
      if (this.showIO) {
        const details = rec.row.querySelector("details");
        if (details) {
          const pre = details.querySelector("pre");
          if (pre) pre.setText(this.serializeStep(step));
        }
      }
    } else {
      const row = this.containerEl.createDiv({
        cls: `opencode-step ${doneCls}`
      });
      const icon = row.createSpan({ cls: "opencode-step-icon" });
      (0, import_obsidian2.setIcon)(icon, isErr ? "x" : toolIcon);
      const main = row.createDiv({ cls: "opencode-step-main" });
      const header = main.createDiv({ cls: "opencode-step-header" });
      const titleEl = header.createDiv({ cls: "opencode-step-title" });
      const durationEl = header.createSpan({
        cls: "opencode-step-duration hidden"
      });
      this.renderStepTitle(titleEl, step);
      this.updateDuration(durationEl, step.durationMs);
      this.renderTodoPreview(main, step);
      if (this.showIO) this.buildStepDetails(main, step);
      this.steps.set(step.id, {
        row,
        icon,
        main,
        titleEl,
        durationEl,
        status: step.state
      });
    }
    this.onScrollRequest();
  }
  finalize() {
    for (const rec of this.steps.values()) {
      if (rec.status === "running") {
        rec.status = "done";
        rec.row.removeClass("opencode-step--running");
        rec.row.addClass("opencode-step--done");
        rec.icon.empty();
        (0, import_obsidian2.setIcon)(rec.icon, "check");
      }
    }
  }
  renderStepTitle(titleEl, step) {
    titleEl.empty();
    const { label, target } = formatToolAction(step.tool, step.title, this.t);
    titleEl.createSpan({ cls: "opencode-step-badge", text: label });
    if (target) {
      titleEl.createSpan({ cls: "opencode-step-target", text: target });
    }
  }
  updateDuration(durationEl, durationMs) {
    if (typeof durationMs === "number" && durationMs > 0) {
      const secs = (durationMs / 1e3).toFixed(1);
      const label = durationMs < 1e3 ? `${durationMs}ms` : `${secs}s`;
      durationEl.setText(label);
      durationEl.removeClass("hidden");
    }
  }
  renderTodoPreview(main, step) {
    if (step.tool !== "todowrite") return;
    const inp = step.input && typeof step.input === "object" ? step.input :
      null;
    const todos = inp && Array.isArray(inp.todos) ? inp.todos : null;
    if (!todos || todos.length === 0) return;
    const existingList = main.querySelector(".opencode-todo-list");
    if (existingList) existingList.remove();
    const listEl = main.createDiv({ cls: "opencode-todo-list" });
    for (const rawTodo of todos.slice(0, 8)) {
      if (!rawTodo || typeof rawTodo !== "object") continue;
      const td = rawTodo;
      if (!td.content) continue;
      const status = td.status || "pending";
      const itemEl = listEl.createDiv({
        cls: `opencode-todo-item opencode-todo-item--${status}`
      });
      const mark = td.status === "completed" ? "\u2713" : td
        .status === "in_progress" ? "\u25B8" : "\u25CB";
      itemEl.createSpan({ cls: "opencode-todo-mark", text: mark });
      itemEl.createSpan({ cls: "opencode-todo-text", text: td.content });
    }
  }
  buildStepDetails(main, step) {
    const det = main.createEl("details", { cls: "opencode-step-details" });
    det.createEl("summary").setText(this.t("Details"));
    const pre = det.createEl("pre", { cls: "opencode-step-io" });
    pre.setText(this.serializeStep(step));
  }
  serializeStep(step) {
    const parts = [];
    const fmt = (v) => {
      const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
      return s.length > 4e3 ? s.slice(0, 4e3) + "\u2026" : s;
    };
    if (step.input !== void 0 && step.input !== null) {
      parts.push(this.t("INPUT:") + "\n" + fmt(step.input));
    }
    if (step.output !== void 0 && step.output !== null) {
      parts.push(this.t("OUTPUT:") + "\n" + fmt(step.output));
    }
    return parts.join("\n\n---\n\n") || this.t("(no details)");
  }
};

// src/features/chat/questionCard.ts
var import_obsidian3 = require("obsidian");
function formatQuestionAnswers(questions, selectedByIdx, customByIdx, t) {
  var _a, _b;
  const lines = [];
  if (questions.length > 1) {
    lines.push(t("Here are my answers to your questions:"));
    lines.push("");
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const selected = Array.from((_a = selectedByIdx.get(i)) != null ? _a : []);
    const custom = ((_b = customByIdx.get(i)) != null ? _b : "").trim();
    const allAnswers = [...selected];
    if (custom) allAnswers.push(custom);
    const joined = allAnswers.join(", ");
    if (questions.length === 1) {
      lines.push(joined);
    } else {
      const label = q.header ? `${q.header} \u2014 ${q.question}` : q.question;
      lines.push(`- **${label}**: ${joined || "\u2014"}`);
    }
  }
  return lines.join("\n").trim();
}
function renderQuestionCard(container, questions, t, onSubmit,
  onScrollRequest) {
  if (!questions || questions.length === 0) return;
  const card = container.createDiv({ cls: "opencode-question-card" });
  const headerRow = card.createDiv({ cls: "opencode-question-card-header" });
  const iconSpan = headerRow.createSpan({ cls: "opencode-question-card-icon" });
  (0, import_obsidian3.setIcon)(iconSpan, "help-circle");
  headerRow.createSpan({
    cls: "opencode-question-card-title",
    text: t("Agent question")
  });
  const selectedByIdx = /* @__PURE__ */ new Map();
  const customByIdx = /* @__PURE__ */ new Map();
  const allOptionBtns = [];
  const allInputs = [];
  questions.forEach((q, qIdx) => {
    const selected = /* @__PURE__ */ new Set();
    selectedByIdx.set(qIdx, selected);
    const block = card.createDiv({ cls: "opencode-question-block" });
    if (q.header) {
      block.createDiv({ cls: "opencode-question-badge", text: q.header });
    }
    block.createDiv({ cls: "opencode-question-prompt", text: q.question });
    const hintText = q.multiple ? t("Select one or more options") : t(
      "Select an option");
    block.createDiv({
      cls: "opencode-question-hint",
      text: hintText
    });
    const optsEl = block.createDiv({ cls: "opencode-question-options" });
    const blockBtns = [];
    for (const opt of q.options) {
      const btn = optsEl.createEl("button", {
        cls: "opencode-question-opt",
        attr: { type: "button" }
      });
      const checkSpan = btn.createSpan({ cls: "opencode-question-opt-check" });
      checkSpan.setText(q.multiple ? "\u2610" : "\u25CB");
      const textCol = btn.createDiv({ cls: "opencode-question-opt-content" });
      textCol.createDiv({
        cls: "opencode-question-opt-label",
        text: opt.label
      });
      if (opt.description) {
        textCol.createDiv({
          cls: "opencode-question-opt-desc",
          text: opt.description
        });
      }
      btn.addEventListener("click", () => {
        if (card.hasClass("is-submitted")) return;
        if (q.multiple) {
          if (selected.has(opt.label)) {
            selected.delete(opt.label);
            btn.removeClass("is-selected");
            checkSpan.setText("\u2610");
          } else {
            selected.add(opt.label);
            btn.addClass("is-selected");
            checkSpan.setText("\u2611");
          }
        } else {
          selected.clear();
          for (const b of blockBtns) {
            b.removeClass("is-selected");
            const c = b.querySelector(".opencode-question-opt-check");
            if (c) c.setText("\u25CB");
          }
          selected.add(opt.label);
          btn.addClass("is-selected");
          checkSpan.setText("\u25CF");
        }
      });
      blockBtns.push(btn);
      allOptionBtns.push(btn);
    }
    const customWrap = block.createDiv({ cls: "opencode-question-custom" });
    const customInput = customWrap.createEl("input", {
      cls: "opencode-question-custom-input",
      attr: {
        type: "text",
        placeholder: t("Other / custom answer...")
      }
    });
    customInput.addEventListener("input", () => {
      customByIdx.set(qIdx, customInput.value);
    });
    customInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitBtn.click();
      }
    });
    allInputs.push(customInput);
  });
  const actions = card.createDiv({ cls: "opencode-question-actions" });
  const submitBtn = actions.createEl("button", {
    cls: "opencode-question-submit",
    attr: { type: "button" }
  });
  submitBtn.setText(t("Send answer"));
  submitBtn.addEventListener("click", () => {
    if (card.hasClass("is-submitted")) return;
    const formatted = formatQuestionAnswers(
      questions,
      selectedByIdx,
      customByIdx,
      t
    );
    if (!formatted) {
      new import_obsidian3.Notice(t(
        "Please select or type an answer before sending."));
      return;
    }
    card.addClass("is-submitted");
    submitBtn.disabled = true;
    submitBtn.setText("\u2713 " + t("Answer sent"));
    for (const b of allOptionBtns) b.disabled = true;
    for (const inp of allInputs) inp.disabled = true;
    onSubmit(formatted);
  });
  onScrollRequest();
}

// src/features/chat/messageBubble.ts
function metaWithCopy(row, label, getText, onCopy, copyTitle) {
  const meta = row.createDiv({ cls: "opencode-meta" });
  meta.createSpan({ text: label });
  meta.createSpan({ cls: "opencode-meta-spacer" });
  const btn = meta.createEl("button", {
    cls: "opencode-icon-btn",
    attr: { title: copyTitle }
  });
  (0, import_obsidian4.setIcon)(btn, "copy");
  btn.addEventListener("click", () => onCopy(getText()));
}
function renderUserBubble(container, text, ctxLabel, t, onCopy) {
  const row = container.createDiv({
    cls: "opencode-message opencode-message--user"
  });
  metaWithCopy(row, t("You"), () => text, onCopy, t("Copy text"));
  if (ctxLabel) {
    row.createDiv({
      cls: "opencode-context-hint",
      text: `${t("with context:")} ${ctxLabel}`
    });
  }
  row.createDiv({ cls: "opencode-bubble", text });
}
function renderErrorBubble(container, msg, t, onCopy) {
  const row = container.createDiv({
    cls: "opencode-message opencode-message--error"
  });
  metaWithCopy(row, t("Error"), () => msg, onCopy, t("Copy text"));
  row.createDiv({ cls: "opencode-bubble", text: msg });
}
var AssistantBubble = class {
  constructor(row, app, component, assistantLabel, t, showIO, onScrollRequest,
    onCopy, fmtTokens, onAnswerQuestion) {
    this.row = row;
    this.app = app;
    this.component = component;
    this.assistantLabel = assistantLabel;
    this.t = t;
    this.showIO = showIO;
    this.onScrollRequest = onScrollRequest;
    this.onCopy = onCopy;
    this.fmtTokens = fmtTokens;
    this.onAnswerQuestion = onAnswerQuestion;
    __publicField(this, "reasoningEl");
    __publicField(this, "reasoningContent");
    __publicField(this, "contentEl");
    __publicField(this, "questionsEl");
    __publicField(this, "statsEl");
    __publicField(this, "activityBarEl");
    __publicField(this, "activityTextEl");
    __publicField(this, "activityTimerEl");
    /** Backwards-compatible status accessor that updates the activity bar. */
    __publicField(this, "status");
    __publicField(this, "stepManager");
    __publicField(this, "rawText", "");
    __publicField(this, "rawReasoning", "");
    __publicField(this, "turnInput", 0);
    __publicField(this, "turnOutput", 0);
    __publicField(this, "turnReasoning", 0);
    __publicField(this, "turnCost", 0);
    __publicField(this, "lastCacheRead", 0);
    __publicField(this, "lastCacheWrite", 0);
    __publicField(this, "lastTokens");
    __publicField(this, "lastCost");
    __publicField(this, "renderTimer", null);
    __publicField(this, "reasoningTimer", null);
    __publicField(this, "elapsedTimer", null);
    __publicField(this, "startedAtMs", Date.now());
    __publicField(this, "isFinalized", false);
    metaWithCopy(
      this.row,
      this.assistantLabel,
      () => this.rawText,
      this.onCopy,
      this.t("Copy text")
    );
    this.reasoningEl = this.row.createEl("details", {
      cls: "opencode-reasoning hidden"
    });
    const summary = this.reasoningEl.createEl("summary");
    summary.setText(this.t("Reasoning"));
    this.reasoningContent = this.reasoningEl.createDiv({
      cls: "opencode-reasoning-content"
    });
    const stepsEl = this.row.createDiv({ cls: "opencode-steps" });
    this.stepManager = new StepManager(
      stepsEl,
      this.t,
      this.showIO,
      this.onScrollRequest
    );
    this.contentEl = this.row.createDiv({
      cls: "opencode-bubble opencode-bubble--assistant hidden"
    });
    this.questionsEl = this.row.createDiv({
      cls: "opencode-questions-container"
    });
    this.statsEl = this.row.createDiv({ cls: "opencode-msg-stats hidden" });
    this.activityBarEl = this.row.createDiv({
      cls: "opencode-activity-bar hidden"
    });
    this.activityBarEl.createSpan({ cls: "opencode-activity-spinner" });
    this.activityTextEl = this.activityBarEl.createSpan({
      cls: "opencode-activity-text"
    });
    this.activityTimerEl = this.activityBarEl.createSpan({
      cls: "opencode-activity-timer"
    });
    this.status = {
      setText: (text) => this.setActivity(text)
    };
  }
  setActivity(text, warning = false) {
    if (this.isFinalized) return;
    const clean = text.trim();
    if (!clean) {
      this.activityBarEl.addClass("hidden");
      return;
    }
    this.activityBarEl.removeClass("hidden");
    this.activityBarEl.toggleClass("is-warning", warning);
    this.activityTextEl.setText(clean);
    this.startElapsedClock();
  }
  startElapsedClock() {
    if (this.elapsedTimer !== null) return;
    this.startedAtMs = Date.now();
    this.updateElapsedDisplay();
    this.elapsedTimer = window.setInterval(() => {
      this.updateElapsedDisplay();
    }, 1e3);
  }
  stopElapsedClock() {
    if (this.elapsedTimer !== null) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }
  updateElapsedDisplay() {
    const elapsedMs = Date.now() - this.startedAtMs;
    const totalSec = Math.max(0, Math.floor(elapsedMs / 1e3));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const pad = secs < 10 ? "0" : "";
    const formatted = mins > 0 ? `${mins}:${pad}${secs}` : `${secs}s`;
    this.activityTimerEl.setText(formatted);
  }
  setText(text) {
    this.rawText = text;
    if (text.trim()) {
      this.contentEl.removeClass("hidden");
    }
    if (text.length <= 3e4) {
      this.scheduleRender();
    } else {
      if (this.renderTimer !== null) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }
      this.contentEl.empty();
      this.contentEl.textContent = text;
    }
    this.onScrollRequest();
  }
  scheduleRender() {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.flushRender(), 120);
  }
  flushRender() {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.rawText.length > 3e4) {
      this.contentEl.empty();
      this.contentEl.textContent = this.rawText;
      return;
    }
    this.contentEl.empty();
    if (this.rawText.trim()) {
      import_obsidian4.MarkdownRenderer.render(
        this.app,
        this.rawText,
        this.contentEl,
        "",
        this.component
      );
    }
  }
  setReasoning(text) {
    this.rawReasoning = text;
    this.reasoningEl.removeClass("hidden");
    this.scheduleReasoningRender();
    this.onScrollRequest();
  }
  scheduleReasoningRender() {
    if (this.reasoningTimer !== null) clearTimeout(this.reasoningTimer);
    this.reasoningTimer = window.setTimeout(
      () => this.flushReasoningRender(),
      120
    );
  }
  flushReasoningRender() {
    if (this.reasoningTimer !== null) {
      clearTimeout(this.reasoningTimer);
      this.reasoningTimer = null;
    }
    const MAX = 5e4;
    const shown = this.rawReasoning.length > MAX ? "\u2026 " + this.rawReasoning
      .slice(this.rawReasoning.length - MAX) : this.rawReasoning;
    this.reasoningContent.textContent = shown;
  }
  addStep(step) {
    this.stepManager.addStep(step);
  }
  addQuestions(questions) {
    renderQuestionCard(
      this.questionsEl,
      questions,
      this.t,
      (answer) => {
        var _a;
        return (_a = this.onAnswerQuestion) == null ? void 0 : _a.call(this,
          answer);
      },
      this.onScrollRequest
    );
  }
  setFinish(info) {
    var _a, _b, _c, _d, _e, _f;
    if (info.tokens) {
      this.turnInput += (_a = info.tokens.input) != null ? _a : 0;
      this.turnOutput += (_b = info.tokens.output) != null ? _b : 0;
      this.turnReasoning += (_c = info.tokens.reasoning) != null ? _c : 0;
      if (((_d = info.tokens.cache) == null ? void 0 : _d.read) !== void 0) {
        this.lastCacheRead = info.tokens.cache.read;
      }
      if (((_e = info.tokens.cache) == null ? void 0 : _e.write) !== void 0) {
        this.lastCacheWrite = info.tokens.cache.write;
      }
    }
    this.turnCost += (_f = info.cost) != null ? _f : 0;
    if (info.tokens) {
      const total = this.turnInput + this.turnOutput + this.turnReasoning;
      this.lastTokens = {
        total,
        input: this.turnInput,
        output: this.turnOutput,
        reasoning: this.turnReasoning,
        cache: this.lastCacheRead > 0 || this.lastCacheWrite > 0 ? { read: this
          .lastCacheRead, write: this.lastCacheWrite } : void 0
      };
      this.lastCost = this.turnCost;
      this.statsEl.removeClass("hidden");
      this.statsEl.setText(
        this.fmtTokens(total, this.turnInput, this.turnOutput, this.turnCost)
      );
    }
  }
  getSnapshot() {
    return {
      text: this.rawText,
      reasoning: this.rawReasoning,
      tokens: this.lastTokens,
      cost: this.lastCost
    };
  }
  finalize() {
    this.isFinalized = true;
    this.stopElapsedClock();
    this.activityBarEl.addClass("hidden");
    this.contentEl.empty();
    if (this.rawText.trim()) {
      this.contentEl.removeClass("hidden");
      if (this.rawText.length <= 3e4) {
        import_obsidian4.MarkdownRenderer.render(
          this.app,
          this.rawText,
          this.contentEl,
          "",
          this.component
        );
      } else {
        this.contentEl.textContent = this.rawText;
      }
    } else {
      this.contentEl.addClass("hidden");
    }
    this.stepManager.finalize();
  }
  dispose() {
    this.stopElapsedClock();
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.reasoningTimer !== null) {
      clearTimeout(this.reasoningTimer);
      this.reasoningTimer = null;
    }
  }
};

// src/features/chat/suggestPopup.ts
var MAX_SUGGEST = 50;
var SuggestPopup = class {
  constructor(container, inputEl, app, plugin, cb) {
    this.inputEl = inputEl;
    this.app = app;
    this.plugin = plugin;
    this.cb = cb;
    __publicField(this, "suggestEl");
    __publicField(this, "suggestItems", []);
    __publicField(this, "suggestRows", []);
    __publicField(this, "suggestIndex", 0);
    __publicField(this, "suggestOpen", false);
    __publicField(this, "suggestTrigger", null);
    __publicField(this, "vaultPaths", null);
    __publicField(this, "vaultPathsLower", null);
    this.suggestEl = container.createDiv({ cls: "opencode-suggest hidden" });
  }
  isOpen() {
    return this.suggestOpen;
  }
  invalidateVaultCache() {
    this.vaultPaths = null;
    this.vaultPathsLower = null;
  }
  handleKeydown(e) {
    if (!this.suggestOpen) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const maxIdx = this.suggestItems.length - 1;
      this.suggestIndex = Math.min(this.suggestIndex + 1, maxIdx);
      this.highlightSuggest();
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.suggestIndex = Math.max(this.suggestIndex - 1, 0);
      this.highlightSuggest();
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      this.chooseSuggest(this.suggestIndex);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return true;
    }
    return false;
  }
  onInputChange() {
    if (this.suggestOpen && !this.suggestTrigger) {
      this.close();
    }
    const tr = this.detectTrigger();
    if (!tr) {
      this.close();
      return;
    }
    const items = this.buildSuggestItems(tr.char, tr.query);
    if (items.length === 0) {
      this.close();
      return;
    }
    this.suggestTrigger = { char: tr.char, start: tr.start };
    this.suggestItems = items;
    this.suggestIndex = 0;
    this.suggestOpen = true;
    this.renderSuggest();
  }
  close() {
    this.suggestOpen = false;
    this.suggestTrigger = null;
    this.suggestItems = [];
    this.suggestRows = [];
    this.suggestIndex = 0;
    this.suggestEl.addClass("hidden");
    this.suggestEl.empty();
  }
  detectTrigger() {
    var _a, _b;
    const v = this.inputEl.value;
    const pos = (_a = this.inputEl.selectionStart) != null ? _a : v.length;
    const beforeCursor = v.slice(0, pos);
    const promptMatch = beforeCursor.match(
      /(?:^|\s)(\/prompt(?::|\s+)([^\n]*))$/i
    );
    if (promptMatch && promptMatch.index !== void 0) {
      const fullMatch = promptMatch[0];
      const leadingWs = fullMatch.length - promptMatch[1].length;
      const start2 = promptMatch.index + leadingWs;
      return {
        char: "/",
        start: start2,
        query: "prompt:" + ((_b = promptMatch[2]) != null ? _b : "")
          .toLowerCase()
      };
    }
    let i = pos - 1;
    while (i >= 0 && !/\s/.test(v[i])) i--;
    const start = i + 1;
    const token = v.slice(start, pos);
    if (!token) return null;
    const ch = token[0];
    if (ch !== "/" && ch !== "@" && ch !== "!") return null;
    return { char: ch, start, query: token.slice(1).toLowerCase() };
  }
  buildSuggestItems(char, query) {
    const q = query.toLowerCase();
    if (char === "/") {
      const isPrompt = q === "prompt" || q.startsWith("prompt:") || q
        .startsWith("prompt ");
      if (isPrompt) {
        const sub = q.startsWith("prompt") ? query.slice(6).replace(/^[:\s]+/,
          "") : "";
        return this.promptItems(sub);
      }
      return this.filterItems(this.commandItems(), q);
    }
    if (char === "@") {
      return this.fileItems(query);
    }
    return this.filterItems(this.actionItems(), q);
  }
  filterItems(items, q) {
    if (!q) return items;
    return items.filter(
      (x) => {
        var _a;
        return x.label.toLowerCase().includes(q) || ((_a = x.desc) != null ?
          _a : "").toLowerCase().includes(q);
      }
    );
  }
  promptItems(sub) {
    var _a;
    const prompts = (_a = this.plugin.settings.prompts) != null ? _a : [];
    if (prompts.length === 0) {
      return [
        {
          label: "/prompt",
          desc: this.plugin.t("No saved prompts \u2014 add them in Settings"),
          action: () => this.removeTrigger()
        }
      ];
    }
    const q = sub.trim().toLowerCase();
    const list = q ? prompts.filter((p) => p.name.toLowerCase().includes(q)) :
      prompts;
    return list.map((p) => ({
      label: p.name,
      desc: p.text.length > 80 ? p.text.slice(0, 77) + "\u2026" : p.text,
      action: () => this.replaceTriggerWith(p.text)
    }));
  }
  replaceTriggerWith(text) {
    var _a;
    const tr = this.suggestTrigger;
    if (tr) {
      const v = this.inputEl.value;
      const end = (_a = this.inputEl.selectionStart) != null ? _a : v.length;
      this.inputEl.value = v.slice(0, tr.start) + text + v.slice(end);
      const pos = tr.start + text.length;
      this.inputEl.setSelectionRange(pos, pos);
    }
    this.close();
    this.inputEl.focus();
  }
  startPromptSelection() {
    var _a;
    const tr = this.suggestTrigger;
    if (tr) {
      const v = this.inputEl.value;
      const end = (_a = this.inputEl.selectionStart) != null ? _a : v.length;
      const token = "/prompt:";
      this.inputEl.value = v.slice(0, tr.start) + token + v.slice(end);
      const pos = tr.start + token.length;
      this.inputEl.setSelectionRange(pos, pos);
    } else {
      this.inputEl.value = "/prompt:";
      const len = this.inputEl.value.length;
      this.inputEl.setSelectionRange(len, len);
    }
    this.inputEl.focus();
    this.onInputChange();
  }
  commandItems() {
    return [
      {
        label: this.plugin.t("/model"),
        desc: this.plugin.t("Change the model"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenModelList();
        }
      },
      {
        label: this.plugin.t("/new"),
        desc: this.plugin.t("New session"),
        action: () => {
          this.removeTrigger();
          this.cb.onStartNewSession();
        }
      },
      {
        label: this.plugin.t("/note"),
        desc: this.plugin.t("Attach the current note"),
        action: () => {
          this.removeTrigger();
          this.cb.onAttachCurrentNote();
        }
      },
      {
        label: this.plugin.t("/attach"),
        desc: this.plugin.t("Attach a file"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenFilePicker();
        }
      },
      {
        label: this.plugin.t("/stats"),
        desc: this.plugin.t("Token and cost statistics"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenStats();
        }
      },
      {
        label: this.plugin.t("/pin"),
        desc: this.plugin.t("Pin/Unpin session"),
        action: () => {
          this.removeTrigger();
          this.cb.onTogglePin();
        }
      },
      {
        label: this.plugin.t("/rename"),
        desc: this.plugin.t("Rename session"),
        action: () => {
          this.removeTrigger();
          this.cb.onRenameSession();
        }
      },
      {
        label: this.plugin.t("/prompt"),
        desc: this.plugin.t("Insert a saved prompt"),
        action: () => {
          this.startPromptSelection();
        }
      }
    ];
  }
  fileItems(query) {
    var _a;
    if (!this.vaultPaths) {
      this.vaultPaths = this.app.vault.getFiles().map((f) => f.path).sort((a,
        b) => a.localeCompare(b));
      this.vaultPathsLower = this.vaultPaths.map((p) => p.toLowerCase());
    }
    const paths = this.vaultPaths;
    const lower = (_a = this.vaultPathsLower) != null ? _a : [];
    const q = query.toLowerCase();
    const desc = this.plugin.t("Attached");
    const items = [];
    for (let i = 0; i < paths.length && items.length < MAX_SUGGEST; i++) {
      if (q && !lower[i].includes(q)) continue;
      const p = paths[i];
      items.push({
        label: p,
        desc,
        action: () => {
          this.removeTrigger();
          this.cb.onAddAttachment(p);
        }
      });
    }
    return items;
  }
  actionItems() {
    return [
      {
        label: this.plugin.t("current note"),
        desc: this.plugin.t("Attach the open note as context"),
        action: () => {
          this.removeTrigger();
          this.cb.onAttachCurrentNote();
        }
      },
      {
        label: this.plugin.t("attach file"),
        desc: this.plugin.t("Pick a file to attach"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenFilePicker();
        }
      },
      {
        label: this.plugin.t("new session"),
        desc: this.plugin.t("Start from an empty session"),
        action: () => {
          this.removeTrigger();
          this.cb.onStartNewSession();
        }
      },
      {
        label: this.plugin.t("statistics"),
        desc: this.plugin.t("Tokens and costs (5h, week, month)"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenStats();
        }
      },
      {
        label: this.plugin.t("pin/unpin session"),
        desc: this.plugin.t("Pin the session in the list"),
        action: () => {
          this.removeTrigger();
          this.cb.onTogglePin();
        }
      },
      {
        label: this.plugin.t("active model"),
        desc: this.plugin.t("Change the model"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenModelList();
        }
      }
    ];
  }
  renderSuggest() {
    this.suggestEl.empty();
    this.suggestRows = [];
    if (this.suggestItems.length === 0) {
      this.close();
      return;
    }
    this.suggestEl.removeClass("hidden");
    for (let i = 0; i < this.suggestItems.length; i++) {
      const it = this.suggestItems[i];
      const row = this.suggestEl.createDiv({ cls: "opencode-suggest-item" });
      row.createDiv({ text: it.label, cls: "opencode-suggest-label" });
      if (it.desc) {
        row.createDiv({ text: it.desc, cls: "opencode-suggest-desc" });
      }
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.chooseSuggest(i);
      });
      this.suggestRows.push(row);
    }
    this.highlightSuggest();
  }
  highlightSuggest() {
    for (let i = 0; i < this.suggestRows.length; i++) {
      this.suggestRows[i].toggleClass("is-active", i === this.suggestIndex);
    }
    const current = this.suggestRows[this.suggestIndex];
    if (current) current.scrollIntoView({ block: "nearest" });
  }
  chooseSuggest(index) {
    const item = this.suggestItems[index];
    if (item) item.action();
  }
  removeTrigger() {
    var _a;
    const tr = this.suggestTrigger;
    if (!tr) return;
    const v = this.inputEl.value;
    const end = (_a = this.inputEl.selectionStart) != null ? _a : v.length;
    this.inputEl.value = v.slice(0, tr.start) + v.slice(end);
    const pos = Math.min(tr.start, this.inputEl.value.length);
    this.inputEl.setSelectionRange(pos, pos);
    this.close();
    this.inputEl.focus();
  }
};

// src/features/chat/attachmentManager.ts
var import_obsidian5 = require("obsidian");
var import_promises = require("fs/promises");
var DOC_RE = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|epub|html?)$/i;
var AttachmentManager = class {
  constructor(container, app, plugin) {
    this.app = app;
    this.plugin = plugin;
    __publicField(this, "attachmentsBar");
    __publicField(this, "attachments", []);
    this.attachmentsBar = container.createDiv({
      cls: "opencode-attachments-bar hidden"
    });
    this.updateBar();
  }
  openFilePicker() {
    new FileSuggestModal(
      this.app,
      this.plugin,
      (file) => this.addAttachment(file.path)
    ).open();
  }
  addAttachment(path) {
    if (this.attachments.some((a) => a.path === path)) return;
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(path);
    this.attachments.push({ path, label: path, image: isImage });
    this.updateBar();
    if (isImage) {
      new import_obsidian5.Notice(
        this.plugin.t(
            "Image attached: check that the selected model supports images " +
            "(vision)."
        )
      );
    }
  }
  async prepareAttachments(runner) {
    const useAnydoc = this.plugin.settings.anydocEnabled;
    const tasks = this.attachments.map(async (a) => {
      const abs = this.resolveVaultFile(a.path);
      const resolvedPath = abs || a.path;
      if (a.image) return resolvedPath;
      if (!useAnydoc) return resolvedPath;
      const isDoc = DOC_RE.test(a.path);
      if (!isDoc) return resolvedPath;
      try {
        if (!abs) return a.path;
        return await runner.convertDocument(abs);
      } catch (e) {
        const errMsg = e.message;
        const failLabel = this.plugin.t("anydoc conversion failed");
        new import_obsidian5.Notice(`${failLabel}: ${a.label} (${errMsg})`);
        const maxMB = this.plugin.settings.maxAttachMB || 20;
        try {
          if (abs) {
            const st = await (0, import_promises.stat)(abs);
            if (st.size > maxMB * 1024 * 1024) {
              const skipKey = 
                "Attachment skipped: the file is larger than $1 MB and " +
                "could not be converted, so it was not attached.";
              new import_obsidian5.Notice(substitute(this.plugin.t(skipKey),
                maxMB));
              return null;
            }
          }
        } catch (e2) {
        }
        return resolvedPath;
      }
    });
    const results = await Promise.all(tasks);
    return results.filter((p) => typeof p === "string");
  }
  resolveVaultFile(relPath) {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof import_obsidian5.FileSystemAdapter) {
      return adapter.getFullPath(relPath);
    }
    return null;
  }
  updateBar() {
    this.attachmentsBar.empty();
    if (this.attachments.length === 0) {
      this.attachmentsBar.addClass("hidden");
      return;
    }
    this.attachmentsBar.removeClass("hidden");
    for (const a of this.attachments) {
      const chip = this.attachmentsBar.createSpan({
        cls: "opencode-attachment-chip"
      });
      const icon = chip.createSpan({ cls: "opencode-attachment-icon" });
      (0, import_obsidian5.setIcon)(icon, a.image ? "image" : "file-text");
      chip.createSpan({ text: a.label, cls: "opencode-attachment-label" });
      const rm = chip.createEl("button", { cls: "opencode-icon-btn" });
      (0, import_obsidian5.setIcon)(rm, "x");
      rm.addEventListener("click", () => {
        this.attachments = this.attachments.filter((x) => x.path !== a.path);
        this.updateBar();
      });
    }
  }
};

// src/features/chat/view.ts
var CHAT_VIEW_TYPE = "opencode-chat-view";
var ChatView = class extends import_obsidian6.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    __publicField(this, "plugin");
    __publicField(this, "messagesEl");
    __publicField(this, "inputEl");
    __publicField(this, "contextBar");
    __publicField(this, "contextLabelEl");
    __publicField(this, "contextClearBtn");
    __publicField(this, "sessionSelect");
    __publicField(this, "pinBtn");
    __publicField(this, "renameBtn");
    __publicField(this, "deleteBtn");
    __publicField(this, "modelBtn");
    __publicField(this, "sendBtn");
    __publicField(this, "stopBtn");
    __publicField(this, "statsBar");
    __publicField(this, "contextEl");
    __publicField(this, "contextFillEl");
    __publicField(this, "attachmentManager");
    __publicField(this, "suggestPopup");
    __publicField(this, "viewSession");
    __publicField(this, "pendingUser", null);
    __publicField(this, "currentProc", null);
    __publicField(this, "running", false);
    __publicField(this, "dispatching", false);
    __publicField(this, "context", null);
    __publicField(this, "renderTimer", null);
    __publicField(this, "hadStreamError", false);
    __publicField(this, "stoppedByUser", false);
    __publicField(this, "lastStderr", "");
    __publicField(this, "stats", { input: 0, output: 0, total: 0, cost: 0 });
    __publicField(this, "contextLimit", 0);
    __publicField(this, "contextUsed", 0);
    __publicField(this, "contextBaseInput", 0);
    __publicField(this, "contextRunInput", 0);
    __publicField(this, "activityTimer", null);
    __publicField(this, "activeBubble", null);
    this.plugin = plugin;
    this.viewSession = plugin.settings.sessionId;
  }
  getRunner() {
    return this.plugin.getRunnerForSession(this.viewSession);
  }
  /** Engine for the shown session (falls back to the global engine). */
  sessionEngine() {
    const id = this.viewSession;
    const map = this.plugin.settings.sessionEngines;
    return id && (map == null ? void 0 : map[id]) || this.plugin.settings
      .engine;
  }
  /** Active model id for the given engine via its EngineConfig. */
  activeModelFor(engine) {
    const cfg = this.plugin.getEngineConfig(engine);
    const provider = this.plugin.registry.get(engine);
    return cfg.model || (provider == null ? void 0 : provider.descriptor
      .defaultModel) || "";
  }
  /** Human-readable label for an engine from the provider descriptor. */
  engineLabel(engine) {
    const provider = this.plugin.registry.get(engine);
    return (provider == null ? void 0 : provider.costNote) || (
      provider == null ? void 0 : provider.displayName) || engine;
  }
  assistantLabel() {
    const desc = this.getRunner().descriptor;
    return desc.id === "opencode" ? this.plugin.t(desc.shortName) : desc
      .shortName;
  }
  getViewType() {
    return CHAT_VIEW_TYPE;
  }
  getDisplayText() {
    return this.plugin.t("Vault Agents chat");
  }
  getIcon() {
    return "bot";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("opencode-chat");
    this.messagesEl = container.createDiv({ cls: "opencode-messages" });
    this.buildContextBar(container);
    this.attachmentManager = new AttachmentManager(
      container,
      this.app,
      this.plugin
    );
    this.buildStatsBar(container);
    this.buildInputArea(container);
    const inv = () => {
      var _a;
      return (_a = this.suggestPopup) == null ? void 0 : _a
        .invalidateVaultCache();
    };
    this.registerEvent(this.app.vault.on("create", inv));
    this.registerEvent(this.app.vault.on("delete", inv));
    this.registerEvent(this.app.vault.on("rename", inv));
    void this.populateSessionSelect().then(() => {
      this.loadHistoryForSession(this.viewSession);
    });
  }
  onClose() {
    var _a, _b;
    (_a = this.currentProc) == null ? void 0 : _a.abort();
    this.currentProc = null;
    if (this.activityTimer !== null) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    (_b = this.activeBubble) == null ? void 0 : _b.dispose();
    this.activeBubble = null;
    return super.onClose();
  }
  setContext(ctx) {
    this.context = ctx;
    this.updateContextBar();
  }
  focusInput() {
    var _a;
    (_a = this.inputEl) == null ? void 0 : _a.focus();
  }
  sendText(text) {
    if (this.inputEl) this.inputEl.value = text;
    void this.send();
  }
  startNewSession(silent = false) {
    this.viewSession = "";
    this.plugin.settings.sessionId = "";
    void this.plugin.saveSettings();
    void this.populateSessionSelect();
    this.loadHistoryForSession("");
    if (!silent) {
      new import_obsidian6.Notice(
        this.plugin.t("New session: the next message will start from scratch.")
      );
    }
  }
  buildContextBar(container) {
    this.contextBar = container.createDiv({ cls: "opencode-context-bar" });
    this.contextLabelEl = this.contextBar.createSpan({
      cls: "opencode-context-label"
    });
    this.contextClearBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn hidden",
      attr: { title: this.plugin.t("Remove the attached context") }
    });
    (0, import_obsidian6.setIcon)(this.contextClearBtn, "x");
    this.contextClearBtn.addEventListener("click", () => {
      this.context = null;
      this.updateContextBar();
    });
    this.contextBar.createSpan({ cls: "opencode-context-spacer" });
    this.sessionSelect = this.contextBar.createEl("select", {
      cls: "opencode-session-select"
    });
    this.sessionSelect.addEventListener("change", () => {
      const v = this.sessionSelect.value;
      if (v !== this.viewSession) {
        this.viewSession = v;
        this.plugin.settings.sessionId = v;
        void this.plugin.saveSettings();
        this.loadHistoryForSession(v);
      }
      this.updateSessionBtnStates();
    });
    this.pinBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Pin/Unpin session") }
    });
    (0, import_obsidian6.setIcon)(this.pinBtn, "pin");
    this.pinBtn.addEventListener("click", () => this.togglePin());
    this.renameBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Rename session") }
    });
    (0, import_obsidian6.setIcon)(this.renameBtn, "pencil");
    this.renameBtn.addEventListener(
      "click",
      () => this.renameCurrentSession()
    );
    this.deleteBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Delete session") }
    });
    (0, import_obsidian6.setIcon)(this.deleteBtn, "trash");
    this.deleteBtn.addEventListener(
      "click",
      () => this.deleteCurrentSession()
    );
    const statsBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Token and cost statistics") }
    });
    (0, import_obsidian6.setIcon)(statsBtn, "bar-chart-3");
    statsBtn.addEventListener(
      "click",
      () => new StatsModal(this.app, this.plugin, this.sessionEngine()).open()
    );
    const attachBtn = this.contextBar.createEl("button", {
      cls: "opencode-add-note-btn"
    });
    attachBtn.setText("\uFF0B " + this.plugin.t("Attach file"));
    attachBtn.addEventListener(
      "click",
      () => this.attachmentManager.openFilePicker()
    );
    const add = this.contextBar.createEl("button", {
      cls: "opencode-add-note-btn"
    });
    add.setText("+ " + this.plugin.t("Current note"));
    add.addEventListener("click", () => this.attachCurrentNote());
    this.updateContextBar();
  }
  togglePin() {
    var _a;
    const id = this.viewSession;
    if (!id) {
      new import_obsidian6.Notice(this.plugin.t("Select a session to pin."));
      return;
    }
    const pinned = (_a = this.plugin.settings.pinned) != null ? _a : [];
    const idx = pinned.indexOf(id);
    if (idx >= 0) pinned.splice(idx, 1);
    else pinned.push(id);
    this.plugin.settings.pinned = pinned;
    void this.plugin.saveSettings();
    void this.populateSessionSelect();
    const msg = idx >= 0 ? this.plugin.t("Session unpinned.") : this.plugin.t(
      "Session pinned.");
    new import_obsidian6.Notice(msg);
  }
  renameCurrentSession() {
    var _a, _b;
    const id = this.viewSession;
    if (!id) {
      new import_obsidian6.Notice(this.plugin.t("Select a session to rename."));
      return;
    }
    const current = (_b = (_a = this.sessionSelect
      .selectedOptions[0]) == null ? void 0 : _a.textContent) != null ? _b : id;
    new RenameModal(this.app, this.plugin, current, (newTitle) => {
      this.getRunner().renameSession(id, newTitle).then(() => {
        void this.populateSessionSelect();
        new import_obsidian6.Notice(this.plugin.t("Session renamed."));
      }).catch(
        (e) => new import_obsidian6.Notice(
          `${this.plugin.t("Error:")} ${e.message}`)
      );
    }).open();
  }
  deleteCurrentSession() {
    var _a, _b;
    const id = this.viewSession;
    if (!id) {
      new import_obsidian6.Notice(this.plugin.t("Select a session to delete."));
      return;
    }
    const title = (_b = (_a = this.sessionSelect.selectedOptions[0]) == null ?
      void 0 : _a.textContent) != null ? _b : id;
    const confirmTpl = this.plugin.t(
        'Do you want to delete the session "$1"? The history saved in ' +
        'Obsidian will also be removed.'
    );
    new ConfirmModal(
      this.app,
      this.plugin,
      this.plugin.t("Delete session"),
      confirmTpl.replace("$1", title),
      this.plugin.t("Delete"),
      () => {
        this.getRunner().deleteSession(id).then(async () => {
          var _a2;
          await this.plugin.deleteHistory(id);
          const pinned = (_a2 = this.plugin.settings.pinned) != null ? _a2 : [];
          const pi = pinned.indexOf(id);
          if (pi >= 0) pinned.splice(pi, 1);
          this.plugin.settings.pinned = pinned;
          if (this.plugin.settings.sessionEngines) {
            delete this.plugin.settings.sessionEngines[id];
          }
          if (this.viewSession === id) {
            this.viewSession = "";
            this.plugin.settings.sessionId = "";
          }
          await this.plugin.saveSettings();
          await this.populateSessionSelect();
          this.loadHistoryForSession(this.viewSession);
          new import_obsidian6.Notice(this.plugin.t("Session deleted."));
        }).catch(
          (e) => new import_obsidian6.Notice(
            `${this.plugin.t("Error:")} ${e.message}`)
        );
      }
    ).open();
  }
  updateContextBar() {
    if (this.context) {
      this.contextLabelEl.setText(
        `${this.plugin.t("Context:")} ${this.context.label}`
      );
      this.contextLabelEl.show();
      this.contextClearBtn.removeClass("hidden");
    } else {
      this.contextLabelEl.setText("");
      this.contextLabelEl.hide();
      this.contextClearBtn.addClass("hidden");
    }
  }
  async populateSessionSelect() {
    var _a;
    if (!this.sessionSelect) return;
    const sel = this.sessionSelect;
    sel.empty();
    const newOpt = sel.createEl("option");
    newOpt.value = "";
    newOpt.textContent = "\uFF0B " + this.plugin.t("New session");
    try {
      const providers = this.plugin.registry.getAll();
      const results = await Promise.allSettled(
        providers.map((p) => p.listSessions())
      );
      const all = [];
      const seen = /* @__PURE__ */ new Set();
      results.forEach((res, i) => {
        if (res.status === "fulfilled") {
          const providerId = providers[i].id;
          for (const s of res.value) {
            if (!seen.has(s.id)) {
              seen.add(s.id);
              const engine = s.engine || providerId;
              all.push({ ...s, engine });
              if (!this.plugin.settings.sessionEngines) {
                this.plugin.settings.sessionEngines = {};
              }
              if (!this.plugin.settings.sessionEngines[s.id]) {
                this.plugin.settings.sessionEngines[s.id] = engine;
              }
            }
          }
        }
      });
      all.sort((a, b) => {
        var _a2, _b;
        return ((_a2 = b.updated) != null ? _a2 : 0) - ((_b = a
          .updated) != null ? _b : 0);
      });
      const pinnedSet = new Set((_a = this.plugin.settings.pinned) != null ?
        _a : []);
      const pinned = all.filter((s) => pinnedSet.has(s.id));
      const recent = all.filter((s) => !pinnedSet.has(s.id)).slice(0, 20);
      const displayed = [...pinned, ...recent];
      const hasActive = displayed.some((s) => s.id === this.viewSession);
      if (this.viewSession && !hasActive) {
        const found = all.find((s) => s.id === this.viewSession);
        if (found) {
          displayed.push(found);
        } else {
          const hist = this.plugin.getHistory(this.viewSession);
          const firstUser = hist.find(
            (m) => m.role === "user" && m.text.trim()
          );
          const fallbackTitle = firstUser ? firstUser.text.trim().replace(
            /\s+/g, " ").slice(0, 40) : this.viewSession;
          displayed.push({
            id: this.viewSession,
            title: fallbackTitle,
            updated: Date.now(),
            engine: this.sessionEngine()
          });
        }
      }
      for (const s of displayed) {
        const o = sel.createEl("option");
        o.value = s.id;
        const title = s.title || s.id;
        const mark = pinnedSet.has(s.id) ? "\u25CF " : "";
        const short = title.length > 40 ? title.slice(0, 37) + "\u2026" : title;
        o.textContent = mark + short;
        o.title = title;
      }
    } catch (e) {
    }
    sel.value = this.viewSession || "";
    this.updateSessionBtnStates();
  }
  updateSessionBtnStates() {
    var _a;
    const hasSession = !!this.viewSession;
    const sessionMode = this.getRunner().descriptor.supportsSessions;
    const supportsSessions = sessionMode !== "none";
    this.renameBtn.disabled = !hasSession || !supportsSessions;
    this.deleteBtn.disabled = !hasSession || !supportsSessions;
    this.pinBtn.disabled = !hasSession || !supportsSessions;
    const pinnedList = (_a = this.plugin.settings.pinned) != null ? _a : [];
    const pinned = pinnedList.includes(this.viewSession);
    this.pinBtn.toggleClass("is-active", pinned);
  }
  buildStatsBar(container) {
    this.statsBar = container.createDiv({ cls: "opencode-stats-bar" });
    const ctx = this.statsBar.createSpan({ cls: "opencode-context" });
    const track = ctx.createSpan({ cls: "opencode-context-track" });
    this.contextFillEl = track.createSpan({ cls: "opencode-context-fill" });
    this.contextEl = ctx.createSpan({ cls: "opencode-context-text" });
    this.updateContextUsage();
    this.updateStatsBar();
  }
  updateStatsBar() {
    if (!this.statsBar) return;
    const existing = this.statsBar.querySelector(".opencode-stats-text");
    if (existing) existing.remove();
    this.statsBar.createSpan({
      text: this.fmtTokens(
        this.stats.total,
        this.stats.input,
        this.stats.output,
        this.stats.cost,
        this.sessionEngine()
      ),
      cls: "opencode-stats-text"
    });
  }
  updateContextUsage() {
    if (!this.contextEl) return;
    const used = this.contextUsed;
    const limit = this.contextLimit;
    if (!limit) {
      this.contextEl.setText(this.plugin.t("Context:") + " \u2014");
      this.contextFillEl.style.width = "0%";
      return;
    }
    const pct = Math.min(100, Math.round(used / limit * 100));
    this.contextFillEl.style.width = pct + "%";
    const usedK = Math.round(used / 1e3);
    const limitK = Math.round(limit / 1e3);
    this.contextEl.setText(
      `${this.plugin.t("Context:")} ${pct}% (${usedK}K / ${limitK}K)`
    );
  }
  async refreshContext() {
    var _a, _b;
    const sid = this.viewSession;
    if (!sid) {
      this.contextUsed = 0;
      this.contextLimit = 0;
      this.updateContextUsage();
      return;
    }
    try {
      const runner = this.getRunner();
      const tokens = await runner.getSessionTokens(sid);
      this.contextBaseInput = tokens.input;
      this.contextUsed = tokens.input;
      if (typeof tokens.totalTokens === "number" && tokens.totalTokens > this
        .stats.total) {
        this.stats.input = (_a = tokens.totalInput) != null ? _a : this.stats
          .input;
        this.stats.output = (_b = tokens.totalOutput) != null ? _b : this.stats
          .output;
        this.stats.total = tokens.totalTokens;
        if (typeof tokens.totalCost === "number" && tokens.totalCost > 0) {
          this.stats.cost = tokens.totalCost;
        }
        this.updateStatsBar();
      }
      if (!this.contextLimit) {
        const activeMod = this.activeModelFor(runner.id);
        this.contextLimit = await runner.getModelContextLimit(activeMod);
      }
    } catch (e) {
      console.error("[vault-agents] refreshContext error:", e);
    }
    this.updateContextUsage();
  }
  addStats(info) {
    var _a, _b, _c, _d;
    if (info.tokens) {
      const input = (_a = info.tokens.input) != null ? _a : 0;
      const output = (_b = info.tokens.output) != null ? _b : 0;
      const reasoning = (_c = info.tokens.reasoning) != null ? _c : 0;
      const total = input + output + reasoning;
      this.stats.input += input;
      this.stats.output += output;
      this.stats.total += total;
    }
    this.stats.cost += (_d = info.cost) != null ? _d : 0;
    this.updateStatsBar();
  }
  resetStats() {
    this.stats = { input: 0, output: 0, total: 0, cost: 0 };
    this.updateStatsBar();
  }
  async attachCurrentNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new import_obsidian6.Notice(this.plugin.t("No active note"));
      return;
    }
    const content = await this.app.vault.cachedRead(file);
    this.context = { label: file.path, content };
    this.updateContextBar();
    new import_obsidian6.Notice(this.plugin.t("Note added to context."));
  }
  buildInputArea(container) {
    const inputArea = container.createDiv({ cls: "opencode-input-area" });
    const placeholderKey = 
      "Type a message for the agent... (Enter to send, Shift+Enter for a " +
      "new line)";
    this.inputEl = inputArea.createEl("textarea", {
      cls: "opencode-input",
      attr: {
        placeholder: this.plugin.t(placeholderKey)
      }
    });
    this.suggestPopup = new SuggestPopup(
      inputArea,
      this.inputEl,
      this.app,
      this.plugin,
      {
        onOpenModelList: () => void this.openModelList(),
        onStartNewSession: () => this.startNewSession(),
        onAttachCurrentNote: () => void this.attachCurrentNote(),
        onOpenFilePicker: () => this.attachmentManager.openFilePicker(),
        onOpenStats: () => new StatsModal(this.app, this.plugin, this
          .sessionEngine()).open(),
        onTogglePin: () => this.togglePin(),
        onRenameSession: () => this.renameCurrentSession(),
        onAddAttachment: (path) => this.attachmentManager.addAttachment(path)
      }
    );
    this.inputEl.addEventListener("keydown", (e) => {
      if (this.suggestPopup.handleKeydown(e)) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.send();
      }
    });
    this.inputEl.addEventListener(
      "input",
      () => this.suggestPopup.onInputChange()
    );
    const buttons = inputArea.createDiv({ cls: "opencode-buttons" });
    this.modelBtn = buttons.createEl("button", { cls: "opencode-model-btn" });
    this.updateModelBtn();
    this.modelBtn.addEventListener("click", () => void this.openModelList());
    buttons.createSpan({ cls: "opencode-buttons-spacer" });
    this.sendBtn = buttons.createEl("button", { cls: "opencode-send-btn" });
    this.sendBtn.setText(this.plugin.t("Send"));
    this.sendBtn.addEventListener("click", () => void this.send());
    this.stopBtn = buttons.createEl("button", { cls: "opencode-stop-btn" });
    this.stopBtn.setText(this.plugin.t("Stop"));
    this.stopBtn.addClass("hidden");
    this.stopBtn.addEventListener("click", () => {
      var _a;
      this.stoppedByUser = true;
      (_a = this.currentProc) == null ? void 0 : _a.abort();
      window.setTimeout(() => {
        var _a2;
        if (!this.running) return;
        (_a2 = this.currentProc) == null ? void 0 : _a2.abort();
        this.running = false;
        this.pendingUser = null;
        if (this.activityTimer !== null) {
          clearInterval(this.activityTimer);
          this.activityTimer = null;
        }
        this.setRunningUI(false);
      }, 3e3);
    });
  }
  updateModelBtn() {
    if (!this.modelBtn) return;
    const engine = this.sessionEngine();
    const m = this.activeModelFor(engine);
    this.modelBtn.setText(m.length > 30 ? m.slice(0, 27) + "\u2026" : m);
    this.modelBtn.setAttribute("title", `${m} (${this.engineLabel(engine)})`);
  }
  async openModelList() {
    const activeEngine = this.sessionEngine();
    const cur = this.activeModelFor(activeEngine);
    try {
      const providers = this.plugin.registry.getAll();
      const orderedProviders = [
        ...providers.filter((p) => p.id === activeEngine),
        ...providers.filter((p) => p.id !== activeEngine)
      ];
      const results = await Promise.allSettled(
        orderedProviders.map((p) => p.listModels())
      );
      const items = [];
      orderedProviders.forEach((provider, idx) => {
        const res = results[idx];
        const models = res.status === "fulfilled" ? res.value : [];
        const providerLabel = provider.costNote || provider.descriptor
          .shortName;
        for (const m of models) {
          items.push({
            id: m,
            engine: provider.id,
            provider: providerLabel,
            isActive: provider.id === activeEngine && m === cur
          });
        }
      });
      new ModelSuggestModal(this.app, this.plugin, items, (item) => {
        const engineChanged = item.engine !== activeEngine;
        this.plugin.settings.engine = item.engine;
        const cfg = this.plugin.getEngineConfig(item.engine);
        cfg.model = item.id;
        const setPrefix = this.plugin.t("Model set:");
        if (this.viewSession && engineChanged) {
          this.viewSession = "";
          this.plugin.settings.sessionId = "";
          void this.plugin.saveSettings();
          this.loadHistoryForSession("");
          new import_obsidian6.Notice(
            `${setPrefix} ${item.id} (${item.provider})`);
          return;
        }
        if (this.viewSession) {
          if (!this.plugin.settings.sessionEngines) {
            this.plugin.settings.sessionEngines = {};
          }
          this.plugin.settings.sessionEngines[this.viewSession] = item.engine;
        }
        void this.plugin.saveSettings();
        this.updateModelBtn();
        this.updateStatsBar();
        this.contextLimit = 0;
        void this.refreshContext();
        new import_obsidian6.Notice(
          `${setPrefix} ${item.id} (${item.provider})`);
      }).open();
    } catch (e) {
      new import_obsidian6.Notice(`${this.plugin.t("Error:")} ${e.message}`);
    }
  }
  continueInNewSession() {
    if (this.running) {
      new import_obsidian6.Notice(this.plugin.t(
        "There is already a request in progress."));
      return;
    }
    const oldSession = this.viewSession;
    if (!oldSession) {
      new import_obsidian6.Notice(this.plugin.t(
        "Select first the session to summarize."));
      return;
    }
    const bubble = this.addAssistantMessage();
    bubble.status.setText(this.plugin.t("Generating session summary..."));
    this.running = true;
    this.hadStreamError = false;
    this.stoppedByUser = false;
    this.setRunningUI(true);
    const promptText = this.plugin.t(
        "Summarize in detail this conversation: goals, decisions made, " +
        "work done, current state and next steps. Write the summary so the " +
        "work can continue in a new session without losing context."
    );
    const runner = this.getRunner();
    const proc = runner.runStream(
      {
        prompt: promptText,
        fileAttachments: [],
        sessionId: oldSession
      },
      {
        onSession: (id) => {
          this.viewSession = id;
          this.plugin.settings.sessionId = id;
          if (!this.plugin.settings.sessionEngines) {
            this.plugin.settings.sessionEngines = {};
          }
          this.plugin.settings.sessionEngines[id] = runner.id;
          void this.plugin.saveSettings();
        },
        onActivity: (activity) => bubble.setActivity(activity),
        onText: (text) => bubble.setText(text),
        onReasoning: (text) => bubble.setReasoning(text),
        onStep: (step) => bubble.addStep(step),
        onQuestion: (questions) => bubble.addQuestions(questions),
        onFinish: (info) => bubble.setFinish(info),
        onError: (err) => {
          this.hadStreamError = true;
          this.addErrorBubble(err);
        },
        onRaw: (line) => {
          this.lastStderr = line;
        },
        onDone: (code) => {
          const isCurrent = this.currentProc === proc;
          if (isCurrent) this.currentProc = null;
          bubble.finalize();
          if (!isCurrent) return;
          this.running = false;
          this.setRunningUI(false);
          const failed = code !== 0 || this.hadStreamError;
          if (failed && !this.stoppedByUser) {
            if (!this.hadStreamError) {
              const detail = this.lastStderr.trim().replace(/\s+/g, " ").slice(
                0, 300);
              const failMsg = this.plugin.t(
                "The session summary could not be generated."
              );
              const base = `${failMsg} (${code}).`;
              this.addErrorBubble(detail ? `${base} ${detail}` : base);
            }
            const limitNotice = this.plugin.t(
                "Session at the limit: new session created with the recent " +
                "history."
            );
            this.finishContinuation(
              this.buildLocalContinuation(oldSession),
              limitNotice
            );
            return;
          }
          const summary = bubble.getSnapshot().text.trim();
          const sumHeader = this.plugin.t(
            "[SUMMARY OF THE PREVIOUS SESSION]"
          );
          const contFooter = this.plugin.t("Continue the work from here.");
          const prompt = summary ? [sumHeader, summary, "---", contFooter].join(
            "\n\n") : this.plugin.t(
            "Continue the work from the previous session.");
          const okNotice = this.plugin.t(
            "New session created with the summary of the previous one."
          );
          this.finishContinuation(prompt, okNotice);
        }
      }
    );
    this.currentProc = proc;
  }
  finishContinuation(prompt, notice) {
    this.viewSession = "";
    this.plugin.settings.sessionId = "";
    void this.plugin.saveSettings();
    void this.populateSessionSelect();
    this.loadHistoryForSession("");
    this.inputEl.value = prompt;
    this.inputEl.focus();
    new import_obsidian6.Notice(notice);
  }
  buildLocalContinuation(sessionId) {
    const history = this.plugin.getHistory(sessionId);
    const recent = history.slice(-24);
    if (recent.length === 0) {
      return this.plugin.t(
          "The previous session has no saved history. Continue the work " +
          "from here."
      );
    }
    const assistantWho = this.assistantLabel();
    const lines = [];
    for (const rec of recent) {
      const who = rec.role === "user" ? this.plugin.t("User") : assistantWho;
      const text = rec.text.length > 800 ? rec.text.slice(0, 800) + "\u2026" :
        rec.text;
      lines.push(`${who}: ${text}`);
    }
    return this.plugin.t("[RECENT HISTORY OF THE PREVIOUS SESSION]") + "\n" +
      lines.join("\n\n") + "\n\n---\n\n" + this.plugin.t(
      "Continue the work from here, keeping the context above in mind."
    );
  }
  addWelcome() {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--assistant"
    });
    const text = this.plugin.t(
        "Hi! I am Vault Agents, connecting AI agents directly to your " +
        "notes. Write a message below. Try the commands: / for commands, @ " +
        "to attach a file, ! for quick actions."
    );
    metaWithCopy(
      row,
      this.assistantLabel(),
      () => text,
      (t) => this.copyText(t),
      this.plugin.t("Copy text")
    );
    row.createDiv({ text, cls: "opencode-bubble" });
  }
  async send() {
    var _a;
    const raw = this.inputEl.value.trim();
    if (!raw || this.running || this.dispatching) return;
    let prompt = raw;
    const ctxLabel = (_a = this.context) == null ? void 0 : _a.label;
    if (this.context) {
      const header = `[CONTEXT FROM OBSIDIAN - ${this.context.label}]`;
      prompt = `${header}
${this.context.content}

---

` + raw;
      this.context = null;
      this.updateContextBar();
    }
    this.addUserMessage(raw, ctxLabel);
    this.inputEl.value = "";
    this.pendingUser = { text: raw, contextLabel: ctxLabel };
    const currentSession = this.viewSession;
    if (currentSession) {
      void this.plugin.appendHistory(currentSession, {
        role: "user",
        text: raw,
        contextLabel: ctxLabel
      });
      this.pendingUser = null;
    }
    this.dispatching = true;
    try {
      const filePaths = await this.attachmentManager.prepareAttachments(
        this.getRunner()
      );
      this.dispatching = false;
      this.doRun(prompt, filePaths);
    } catch (e) {
      this.dispatching = false;
      new import_obsidian6.Notice(`${this.plugin.t("Error:")} ${e.message}`);
    }
  }
  doRun(prompt, fileAttachments) {
    const bubble = this.addAssistantMessage();
    let currentActivity = this.plugin.t("Connecting to agent...");
    bubble.setActivity(currentActivity);
    this.running = true;
    this.hadStreamError = false;
    this.stoppedByUser = false;
    this.lastStderr = "";
    this.contextRunInput = 0;
    this.setRunningUI(true);
    let lastEventTime = Date.now();
    if (this.activityTimer !== null) clearInterval(this.activityTimer);
    this.activityTimer = window.setInterval(() => {
      if (!this.running) {
        if (this.activityTimer !== null) {
          clearInterval(this.activityTimer);
          this.activityTimer = null;
        }
        return;
      }
      const idleSec = Math.floor((Date.now() - lastEventTime) / 1e3);
      const agoLabel = substitute(
        this.plugin.t("last update $1s ago"),
        idleSec
      );
      if (idleSec >= 20) {
        const stuck = this.plugin.t("Possibly stuck");
        bubble.setActivity(`${currentActivity} \xB7 ${agoLabel} (${stuck})`,
          true);
      } else if (idleSec >= 6) {
        bubble.setActivity(`${currentActivity} \xB7 ${agoLabel}`);
      }
    }, 2e3);
    const runner = this.getRunner();
    const proc = runner.runStream(
      {
        prompt,
        fileAttachments,
        sessionId: this.viewSession
      },
      {
        onSession: (id) => {
          lastEventTime = Date.now();
          const prev = this.viewSession;
          if (prev !== id) {
            this.viewSession = id;
            this.plugin.settings.sessionId = id;
            if (!this.plugin.settings.sessionEngines) {
              this.plugin.settings.sessionEngines = {};
            }
            this.plugin.settings.sessionEngines[id] = runner.id;
            void this.plugin.saveSettings();
            void this.populateSessionSelect();
          }
          if (this.pendingUser) {
            void this.plugin.appendHistory(id, {
              role: "user",
              text: this.pendingUser.text,
              contextLabel: this.pendingUser.contextLabel
            });
            this.pendingUser = null;
          }
        },
        onActivity: (activity) => {
          lastEventTime = Date.now();
          currentActivity = activity;
          bubble.setActivity(activity);
        },
        onText: (text) => {
          lastEventTime = Date.now();
          currentActivity = this.plugin.t("Writing response...");
          bubble.setActivity(currentActivity);
          bubble.setText(text);
        },
        onReasoning: (text) => {
          lastEventTime = Date.now();
          currentActivity = this.plugin.t("Thinking...");
          bubble.setActivity(currentActivity);
          bubble.setReasoning(text);
        },
        onStep: (step) => {
          lastEventTime = Date.now();
          bubble.addStep(step);
        },
        onQuestion: (questions) => {
          lastEventTime = Date.now();
          currentActivity = this.plugin.t("Waiting for your answer...");
          bubble.setActivity(currentActivity);
          bubble.addQuestions(questions);
        },
        onFinish: (info) => {
          var _a, _b, _c, _d, _e;
          lastEventTime = Date.now();
          bubble.setFinish(info);
          this.addStats(info);
          if (info.tokens) {
            const stepContextTokens = ((_a = info.tokens.input) != null ? _a :
              0) + ((_c = (_b = info.tokens.cache) == null ? void 0 : _b
                .read) != null ? _c : 0) + ((_e = (_d = info.tokens
                  .cache) == null ? void 0 : _d.write) != null ? _e : 0);
            if (stepContextTokens > 0) {
              this.contextRunInput = stepContextTokens;
              this.contextUsed = Math.max(
                this.contextBaseInput,
                this.contextRunInput
              );
              this.updateContextUsage();
            }
          }
        },
        onError: (err) => {
          lastEventTime = Date.now();
          this.hadStreamError = true;
          this.handleStreamError(err);
        },
        onRaw: (line) => {
          this.lastStderr = line;
        },
        onDone: (code) => {
          if (this.activityTimer !== null) {
            clearInterval(this.activityTimer);
            this.activityTimer = null;
          }
          const isCurrent = this.currentProc === proc;
          if (isCurrent) this.currentProc = null;
          bubble.finalize();
          if (!isCurrent) return;
          this.running = false;
          this.setRunningUI(false);
          const snap = bubble.getSnapshot();
          const currentSession = this.viewSession;
          if (currentSession && snap.text.trim()) {
            void this.plugin.appendHistory(currentSession, {
              role: "assistant",
              text: snap.text,
              reasoning: snap.reasoning || void 0,
              tokens: snap.tokens,
              cost: snap.cost
            });
          }
          const failed = code !== 0 || this.hadStreamError;
          if (failed && !this.stoppedByUser) {
            this.handleProcessFailure(code);
          }
          this.stoppedByUser = false;
          this.pendingUser = null;
          void this.populateSessionSelect();
          void this.refreshContext();
        }
      }
    );
    this.currentProc = proc;
  }
  addUserMessage(text, ctxLabel) {
    renderUserBubble(
      this.messagesEl,
      text,
      ctxLabel,
      (s) => this.plugin.t(s),
      (t) => this.copyText(t)
    );
    this.scrollToBottom();
  }
  addAssistantMessage() {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--assistant"
    });
    const bubble = new AssistantBubble(
      row,
      this.app,
      this,
      this.assistantLabel(),
      (s) => this.plugin.t(s),
      this.plugin.settings.showToolIO,
      () => this.scheduleScroll(),
      (t) => this.copyText(t),
      (total, input, output, cost) => this.fmtTokens(total, input, output,
        cost, this.sessionEngine()),
      (formattedAnswer) => this.handleQuestionAnswer(formattedAnswer)
    );
    this.activeBubble = bubble;
    this.scrollToBottom();
    return bubble;
  }
  handleQuestionAnswer(formattedAnswer) {
    var _a;
    if (!formattedAnswer.trim()) return;
    if (this.running) {
      this.stoppedByUser = true;
      (_a = this.currentProc) == null ? void 0 : _a.abort();
      window.setTimeout(() => {
        this.sendText(formattedAnswer);
      }, 250);
    } else {
      this.sendText(formattedAnswer);
    }
  }
  addErrorBubble(msg) {
    renderErrorBubble(
      this.messagesEl,
      msg,
      (s) => this.plugin.t(s),
      (t) => this.copyText(t)
    );
    this.scrollToBottom();
  }
  copyText(text) {
    void navigator.clipboard.writeText(text);
    new import_obsidian6.Notice(this.plugin.t("Text copied."));
  }
  handleStreamError(err) {
    const isImageError = /does not support image/i.test(err) || /multimodal/i
      .test(err) || /image.*not supported/i.test(err);
    if (isImageError) {
      this.addErrorBubble(
        this.plugin.t(
            "The selected model does not support images. Remove the " +
            "attached image or choose a multimodal (vision) model from the " +
            "Model menu."
        )
      );
      return;
    }
    const isSessionMissing = /session.*not found/i.test(err) ||
      /no such session/i.test(err) || /session does not exist/i.test(err);
    if (isSessionMissing) {
      this.addErrorBubble(
        this.plugin.t(
            "The saved session no longer exists: a new one will be created," +
            " resend the message."
        )
      );
      if (this.viewSession && this.plugin.settings.sessionEngines) {
        delete this.plugin.settings.sessionEngines[this.viewSession];
      }
      this.viewSession = "";
      this.plugin.settings.sessionId = "";
      void this.plugin.saveSettings();
      void this.populateSessionSelect();
      return;
    }
    this.addErrorBubble(err);
  }
  handleProcessFailure(code) {
    if (this.hadStreamError) return;
    const detail = this.lastStderr.trim().replace(/\s+/g, " ").slice(0, 300);
    const exitKey = 
      "The agent process exited with code $1. Check the binary path and " +
      "the model in the settings.";
    const base = substitute(this.plugin.t(exitKey), code);
    this.addErrorBubble(detail ? `${base} (${detail})` : base);
  }
  loadHistoryForSession(sessionId) {
    var _a, _b, _c;
    this.messagesEl.empty();
    this.resetStats();
    this.contextUsed = 0;
    this.contextBaseInput = 0;
    this.contextRunInput = 0;
    this.contextLimit = 0;
    this.updateContextUsage();
    this.updateModelBtn();
    if (!sessionId) {
      this.addWelcome();
      return;
    }
    const history = this.plugin.getHistory(sessionId);
    if (!history || history.length === 0) {
      this.addWelcome();
      void this.refreshContext();
      return;
    }
    for (const rec of history) {
      if (rec.role === "user") {
        this.addUserMessage(rec.text, rec.contextLabel);
      } else {
        const row = this.messagesEl.createDiv({
          cls: "opencode-message opencode-message--assistant"
        });
        metaWithCopy(
          row,
          this.assistantLabel(),
          () => rec.text,
          (t) => this.copyText(t),
          this.plugin.t("Copy text")
        );
        if (rec.reasoning) {
          const det = row.createEl("details", { cls: "opencode-reasoning" });
          det.createEl("summary", { text: this.plugin.t("Reasoning") });
          det.createDiv({
            cls: "opencode-reasoning-content",
            text: rec.reasoning
          });
        }
        const bubble = row.createDiv({
          cls: "opencode-bubble opencode-bubble--assistant"
        });
        if (rec.text.length <= 3e4) {
          import_obsidian6.MarkdownRenderer.render(this.app, rec.text, bubble,
            "", this);
        } else {
          bubble.textContent = rec.text;
        }
        if (rec.tokens) {
          const inp = (_a = rec.tokens.input) != null ? _a : 0;
          const out = (_b = rec.tokens.output) != null ? _b : 0;
          const reas = (_c = rec.tokens.reasoning) != null ? _c : 0;
          const tot = inp + out + reas;
          const stats = row.createDiv({ cls: "opencode-msg-stats" });
          stats.setText(
            this.fmtTokens(tot, inp, out, rec.cost, this.sessionEngine())
          );
          this.addStats({
            tokens: { ...rec.tokens, total: tot },
            cost: rec.cost
          });
        }
      }
    }
    this.scrollToBottom();
    void this.refreshContext();
  }
  fmtTokens(total, input, output, cost, engine) {
    const locale = this.plugin.settings.language === "it" ? "it-IT" : "en-US";
    const tokLbl = this.plugin.t("Token:");
    const inLbl = this.plugin.t("in");
    const outLbl = this.plugin.t("out");
    const totStr = total.toLocaleString(locale);
    const inStr = input.toLocaleString(locale);
    const outStr = output.toLocaleString(locale);
    const parts = [
      `${tokLbl} ${totStr} (${inStr} ${inLbl} / ${outStr} ${outLbl})`
    ];
    const provider = this.plugin.registry.get(engine != null ? engine : this
      .sessionEngine());
    if (provider == null ? void 0 : provider.included) {
      const inc = this.plugin.t("included");
      parts.push(provider.costNote ? `(${provider.costNote})` : `(${inc})`);
    } else if (typeof cost === "number" && cost > 0) {
      parts.push(`${this.plugin.t("Cost:")} ${cost.toFixed(4)} $`);
    }
    return parts.join(" \xB7 ");
  }
  setRunningUI(running) {
    if (this.sendBtn) this.sendBtn.toggleClass("hidden", running);
    if (this.stopBtn) this.stopBtn.toggleClass("hidden", !running);
    if (this.inputEl) this.inputEl.disabled = running;
  }
  scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
  scheduleScroll() {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.scrollToBottom(), 150);
  }
};

// src/providers/base.ts
var import_child_process = require("child_process");
var import_crypto = require("crypto");
var import_fs = require("fs");
var import_promises2 = require("fs/promises");
var import_path = require("path");
var import_os = require("os");
var MAX_STREAM_LINE_BYTES = 2e7;
var BaseCliRunner = class {
  constructor(plugin) {
    __publicField(this, "plugin");
    __publicField(this, "resolvedBinaries", /* @__PURE__ */ new Map());
    __publicField(this, "activeProcs", /* @__PURE__ */ new Set());
    this.plugin = plugin;
  }
  /**
   * Terminate all currently active child processes
   */
  killAll() {
    for (const child of [...this.activeProcs]) {
      this.killNow(child);
    }
    this.activeProcs.clear();
  }
  /**
   * Forcibly terminate a specific child process
   */
  killNow(child) {
    if (!child || child.pid === void 0) return;
    try {
      if (process.platform === "win32") {
        (0, import_child_process.spawn)("taskkill", ["/pid", String(child.pid),
          "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore"
        });
      } else {
        child.kill("SIGKILL");
      }
    } catch (e) {
    }
    try {
      child.kill();
    } catch (e) {
    }
  }
  /**
   * Terminate process with optional watchdog to ensure exit
   */
  killProc(child, watch = false) {
    this.killNow(child);
    if (!watch) return;
    const deadline = Date.now() + 6e3;
    const timer = setInterval(() => {
      if (child.exitCode !== null || child.signalCode !== null || Date.now(
        ) > deadline) {
        clearInterval(timer);
        return;
      }
      this.killNow(child);
    }, 1e3);
  }
  /**
   * Register a spawned process for tracking and automatic cleanup
   */
  trackProc(child) {
    this.activeProcs.add(child);
    child.once("close", () => this.activeProcs.delete(child));
    child.once("error", () => this.activeProcs.delete(child));
  }
  /**
   * Spawn a CLI process with proper platform flags and environment
   */
  spawnBinary(bin, args, cwd, extraEnv) {
    const isWin = process.platform === "win32";
    const env = cwd || extraEnv ? Object.assign(
      {},
      process.env,
      cwd ? { PWD: cwd } : void 0,
      extraEnv
    ) : process.env;
    const options = {
      cwd,
      shell: isWin && (bin.endsWith(".cmd") || bin.endsWith(".bat")),
      windowsHide: true,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    };
    const child = (0, import_child_process.spawn)(bin, args, options);
    this.trackProc(child);
    return child;
  }
  /**
   * Normalize both `runStream(req, cb)` and legacy
   * `runStream(prompt, files, cb)`
   */
  normalizeRunArgs(reqOrPrompt, fileAttachmentsOrCb, maybeCb) {
    if (typeof reqOrPrompt === "string") {
      return {
        req: {
          prompt: reqOrPrompt,
          fileAttachments: Array.isArray(fileAttachmentsOrCb) ?
            fileAttachmentsOrCb : []
        },
        cb: maybeCb
      };
    }
    return {
      req: reqOrPrompt,
      cb: fileAttachmentsOrCb
    };
  }
  /**
   * Shared JSONL streaming execution loop for CLI providers
   */
  spawnJsonlStream(bin, args, cwd, onLine, cb) {
    var _a, _b, _c;
    const child = this.spawnBinary(bin, args, cwd);
    let buffer = "";
    (_a = child.stdout) == null ? void 0 : _a.on("data", (d) => {
      buffer += d.toString();
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          onLine(line);
        } catch (e) {
          console.error("[vault-agents] error handling stream event:", e);
        }
      }
    });
    (_b = child.stdout) == null ? void 0 : _b.on("end", () => {
      const remaining = buffer.trim();
      if (remaining) {
        try {
          onLine(remaining);
        } catch (e) {
          console.error("[vault-agents] error handling final stream event:", e);
        }
      }
    });
    (_c = child.stderr) == null ? void 0 : _c.on("data", (d) => {
      var _a2;
      (_a2 = cb.onRaw) == null ? void 0 : _a2.call(cb, d.toString());
    });
    child.on("error", (e) => cb.onError(e.message));
    child.on("close", (code) => {
      cb.onDone(code != null ? code : -1);
    });
    return {
      abort: () => this.killProc(child, true)
    };
  }
  /**
   * Execute a CLI binary via promise, returning standard output
   */
  execCli(bin, args, cwd, extraEnv) {
    return new Promise((resolve, reject) => {
      var _a, _b;
      const child = this.spawnBinary(bin, args, cwd, extraEnv);
      let out = "";
      let err = "";
      (_a = child.stdout) == null ? void 0 : _a.on("data", (d) => out += d
        .toString());
      (_b = child.stderr) == null ? void 0 : _b.on("data", (d) => err += d
        .toString());
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else {
          reject(new Error(err.trim() || out.trim() || `exit code ${code}`));
        }
      });
    });
  }
  /**
   * Resolve full path to a CLI executable, checking PATH and candidate folders
   */
  resolveBinaryPath(bin, candidatePaths = []) {
    const cached = this.resolvedBinaries.get(bin);
    if (cached !== void 0 && cached !== null) return cached;
    if (process.platform === "win32") {
      const winResolved = this.findWindowsBinary(bin);
      if (winResolved) {
        this.resolvedBinaries.set(bin, winResolved);
        return winResolved;
      }
    }
    if ((0, import_fs.existsSync)(bin)) {
      this.resolvedBinaries.set(bin, bin);
      return bin;
    }
    const defaultCandidates = [
      (0, import_path.join)((0, import_os.homedir)(), ".local", "bin", bin),
      (0, import_path.join)((0, import_os.homedir)(), ".opencode", "bin", bin),
      (0, import_path.join)((0, import_os.homedir)(), ".gemini",
        "antigravity-cli", "bin", bin),
      `/usr/local/bin/${bin}`,
      `/usr/bin/${bin}`
    ];
    const allCandidates = [...candidatePaths, ...defaultCandidates];
    for (const p of allCandidates) {
      if ((0, import_fs.existsSync)(p)) {
        this.resolvedBinaries.set(bin, p);
        return p;
      }
    }
    return bin;
  }
  findWindowsBinary(bin) {
    var _a;
    if (bin.toLowerCase().endsWith(".exe")) return bin;
    const hasPath = bin.includes("\\") || bin.includes("/");
    if (hasPath) {
      const resolved = this.resolveCmdShim(bin);
      if (resolved) return resolved;
      const dir = (0, import_path.join)(bin, "..");
      const exe = (0, import_path.join)(dir, bin.replace(/\.(cmd|bat|ps1)$/i,
        "") + ".exe");
      return (0, import_fs.existsSync)(exe) ? exe : null;
    }
    const dirs = ((_a = process.env.PATH) != null ? _a : "").split(";").filter(
      Boolean);
    for (const dir of dirs) {
      const cmdPath = (0, import_path.join)(dir, bin + ".cmd");
      const exePath = (0, import_path.join)(dir, bin + ".exe");
      if ((0, import_fs.existsSync)(cmdPath)) {
        const resolved = this.resolveCmdShim(cmdPath);
        if (resolved) return resolved;
      }
      if ((0, import_fs.existsSync)(exePath)) return exePath;
    }
    return null;
  }
  resolveCmdShim(shimPath) {
    try {
      const content = (0, import_fs.readFileSync)(shimPath, "utf8");
      const dir = (0, import_path.dirname)(shimPath);
      const m = content.match(/"([^"]+\.exe)"/i);
      if (m) {
        const target = m[1].replace(/%dp0%/gi, dir).replace(/%base%/gi, dir);
        if ((0, import_fs.existsSync)(target)) return target;
      }
    } catch (e) {
    }
    return null;
  }
  /**
   * Retrieve the absolute filesystem path of the Obsidian vault via RunnerHost
   */
  getVaultPath() {
    return this.plugin.getVaultPath();
  }
  /**
   * Convert a document (PDF, Word, Excel, etc.) to Markdown using anydoc
   */
  async convertDocument(absPath) {
    const hash = (0, import_crypto.createHash)("sha256").update(absPath).digest(
      "hex").slice(0, 16);
    const dir = (0, import_path.join)((0, import_os.tmpdir)(),
      "vault-agents-anydoc");
    await (0, import_promises2.mkdir)(dir, { recursive: true });
    const outPath = (0, import_path.join)(dir, hash + ".md");
    try {
      const [src, out] = await Promise.all([(0, import_promises2.stat)(
        absPath), (0, import_promises2.stat)(outPath)]);
      if (out.mtimeMs >= src.mtimeMs) return outPath;
    } catch (e) {
    }
    const ext = (0, import_path.extname)(absPath) || ".pdf";
    const cleanInput = (0, import_path.join)(dir, "in-" + hash + ext);
    await (0, import_promises2.copyFile)(absPath, cleanInput);
    await this.cleanupTempFiles(dir);
    const bin = this.resolveBinaryPath(
      this.plugin.settings.anydocBinary || "anydoc"
    );
    try {
      await new Promise((resolve, reject) => {
        var _a;
        const child = this.spawnBinary(bin, [
          cleanInput,
          "--ocr",
          "hosted",
          "-o",
          outPath
        ]);
        let err = "";
        (_a = child.stderr) == null ? void 0 : _a.on("data", (d) => err += d
          .toString());
        child.on("error", (e) => reject(e));
        child.on("close", (code) => {
          if (code === 0) resolve();
          else {
            const detail = err.trim().slice(0, 200);
            reject(new Error(`anydoc exited with code ${code}: ${detail}`));
          }
        });
      });
    } finally {
      await (0, import_promises2.unlink)(cleanInput).catch(() => {
      });
    }
    return outPath;
  }
  /**
   * Delete stale temporary files older than maxAgeMs (default 24h)
   */
  async cleanupTempFiles(dir, maxAgeMs = 24 * 3600 * 1e3) {
    try {
      const files = await (0, import_promises2.readdir)(dir);
      const now = Date.now();
      for (const f of files) {
        try {
          const p = (0, import_path.join)(dir, f);
          const st = await (0, import_promises2.stat)(p);
          if (now - st.mtimeMs > maxAgeMs) {
            await (0, import_promises2.unlink)(p);
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
  }
};

// src/providers/antigravity/runner.ts
var import_fs2 = require("fs");
var import_path2 = require("path");
var import_os2 = require("os");
var ANTIGRAVITY_ID_HINT = /-/;
var MAX_INLINE_ATTACHMENT_BYTES = 256 * 1024;
var ANTIGRAVITY_DESCRIPTOR = {
  id: "antigravity",
  displayName: "Antigravity CLI (Google AI Pro)",
  shortName: "Antigravity",
  defaultBinary: "agy",
  defaultModel: "gemini-3.8-flash-high",
  binaryDesc: 
    "Command or full path to the agy executable. Default is 'agy' or '~/." +
    "local/bin/agy'.",
  modelDesc: 
    "Pick a model from Antigravity (Gemini 3.8 Flash, Claude Opus/Sonnet 5." +
    "5). The effort is part of the model name. Included with Google AI Pro.",
  included: true,
  costNote: "Google AI Pro",
  supportsSessions: "local-db",
  supportsUsageStats: true,
  supportsDbCleanup: false,
  options: [
    {
      key: "effort",
      label: "Reasoning effort",
      desc: 
        "Effort sent only for models whose name does not already include " +
        "it. Antigravity model names usually end with -low/-medium/-high.",
      type: "select",
      default: "high",
      choices: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "xhigh", label: "Extra high" },
        { value: "max", label: "Max" }
      ]
    }
  ]
};
var AntigravityRunner = class extends BaseCliRunner {
  constructor(plugin) {
    super(plugin);
    __publicField(this, "descriptor", ANTIGRAVITY_DESCRIPTOR);
    __publicField(this, "id", "antigravity");
    __publicField(this, "displayName", "Antigravity CLI");
    __publicField(this, "engine", "antigravity");
    __publicField(this, "included", true);
    __publicField(this, "costNote", "Google AI Pro");
    __publicField(this, "cachedModels", null);
  }
  getConfig() {
    return this.plugin.getEngineConfig("antigravity");
  }
  async getVersion() {
    const bin = this.resolveBinaryPath(this.getConfig().binary || "agy");
    const out = await this.execCli(bin, ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from agy --version");
    return first;
  }
  async listModels(forceRefresh = false) {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const bin = this.resolveBinaryPath(this.getConfig().binary || "agy");
    try {
      const out = await this.execCli(bin, ["models"]);
      const models = [];
      for (const line of out.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s+/);
        if (match) {
          const id = match[1];
          if (id !== "Fetching" && id !== "Usage" && !models.includes(id)) {
            models.push(id);
          }
        } else if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
          if (trimmed !== "Fetching" && !models.includes(trimmed)) {
            models.push(trimmed);
          }
        }
      }
      if (models.length > 0) {
        this.cachedModels = models;
        return models;
      }
    } catch (e) {
      console.warn("[vault-agents] Failed to fetch agy models dynamically:", e);
    }
    const defaults = [
      "gemini-3.8-flash-high",
      "gemini-3.8-flash-medium",
      "gemini-3.8-flash-low",
      "claude-opus-5-5-high",
      "claude-opus-5-5-medium",
      "claude-opus-5-5-low",
      "claude-sonnet-5-5-high",
      "claude-sonnet-5-5-medium",
      "claude-sonnet-5-5-low",
      "gpt-oss-120b-medium"
    ];
    this.cachedModels = defaults;
    return defaults;
  }
  async listSessions() {
    var _a, _b, _c, _d, _e, _f, _g;
    const sessions = [];
    const seenIds = /* @__PURE__ */ new Set();
    const dbPath = this.getDbPath();
    if ((0, import_fs2.existsSync)(dbPath)) {
      try {
        const query = 
          "SELECT conversation_id AS id, title, CAST(strftime('%s', " +
          "last_modified_time) AS INTEGER) AS sec FROM " +
          "conversation_summaries ORDER BY last_modified_time DESC LIMIT 50";
        const out = await this.execCli("sqlite3", ["-json", dbPath, query]);
        const rows = JSON.parse(out.trim() || "[]");
        for (const row of rows) {
          const id = (_a = row.id) == null ? void 0 : _a.trim();
          if (!id) continue;
          const title = ((_b = row.title) == null ? void 0 : _b.trim()) || id;
          const sec = Number(row.sec);
          const updated = Number.isFinite(sec) && sec > 0 ? sec * 1e3 : Date
            .now();
          sessions.push({
            id,
            title,
            updated,
            engine: "antigravity"
          });
          seenIds.add(id);
        }
      } catch (e) {
        try {
          const query = 
            "SELECT conversation_id, replace(replace(title, char(10), ' ')," +
            " '|', ' '), strftime('%s', last_modified_time) FROM " +
            "conversation_summaries ORDER BY last_modified_time DESC LIMIT " +
            "50";
          const out = await this.execSqlite(dbPath, query);
          for (const line of out.trim().split("\n")) {
            const parts = line.split("|");
            const id = (_c = parts[0]) == null ? void 0 : _c.trim();
            if (!id) continue;
            const title = ((_d = parts[1]) == null ? void 0 : _d.trim()) || id;
            const sec = parseInt(((_e = parts[2]) == null ? void 0 : _e.trim(
              )) || "", 10);
            const updated = !isNaN(sec) && sec > 0 ? sec * 1e3 : Date.now();
            sessions.push({
              id,
              title,
              updated,
              engine: "antigravity"
            });
            seenIds.add(id);
          }
        } catch (e2) {
        }
      }
    }
    const histories = (_f = this.plugin.histories) != null ? _f : {};
    const sessionEngines = (_g = this.plugin.settings.sessionEngines) != null ?
      _g : {};
    for (const [id, msgs] of Object.entries(histories)) {
      if (seenIds.has(id)) continue;
      const isAgy = sessionEngines[id] === "antigravity" ||
        !sessionEngines[id] && ANTIGRAVITY_ID_HINT.test(id);
      if (isAgy) {
        const firstUser = msgs.find((m) => m.role === "user");
        const title = (firstUser == null ? void 0 : firstUser.text) ? firstUser
          .text.slice(0, 40) : id;
        sessions.push({
          id,
          title,
          updated: Date.now(),
          engine: "antigravity"
        });
        seenIds.add(id);
      }
    }
    return sessions;
  }
  async renameSession(sessionId, title) {
    const dbPath = this.getDbPath();
    if ((0, import_fs2.existsSync)(dbPath)) {
      try {
        const safeTitle = title.replace(/'/g, "''");
        const safeId = sessionId.replace(/'/g, "''");
        const query = [
          "UPDATE conversation_summaries",
          `SET title = '${safeTitle}'`,
          `WHERE conversation_id = '${safeId}'`
        ].join(" ");
        await this.execSqlite(dbPath, query);
      } catch (e) {
      }
    }
  }
  async deleteSession(sessionId) {
    const dbPath = this.getDbPath();
    if ((0, import_fs2.existsSync)(dbPath)) {
      try {
        const safeId = sessionId.replace(/'/g, "''");
        const query = [
          "DELETE FROM conversation_summaries",
          `WHERE conversation_id = '${safeId}'`
        ].join(" ");
        await this.execSqlite(dbPath, query);
      } catch (e) {
      }
    }
  }
  async getModelContextLimit(model) {
    const m = model.toLowerCase();
    if (m.includes("gemini")) return 1048576;
    if (m.includes("claude")) return 2e5;
    return 128e3;
  }
  async getSessionTokens(sessionId) {
    var _a, _b;
    const history = this.plugin.getHistory(sessionId);
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "assistant" && msg.tokens) {
        return {
          input: (_a = msg.tokens.input) != null ? _a : 0,
          output: (_b = msg.tokens.output) != null ? _b : 0
        };
      }
    }
    return { input: 0, output: 0 };
  }
  async getUsageStats() {
    var _a, _b, _c, _d;
    const now = Date.now();
    const h5Cutoff = now - 5 * 3600 * 1e3;
    const weekCutoff = now - 7 * 24 * 3600 * 1e3;
    const monthCutoff = now - 30 * 24 * 3600 * 1e3;
    const h5 = { input: 0, output: 0, cost: 0 };
    const week = { input: 0, output: 0, cost: 0 };
    const month = { input: 0, output: 0, cost: 0 };
    const histories = (_a = this.plugin.histories) != null ? _a : {};
    const sessionEngines = (_b = this.plugin.settings.sessionEngines) != null ?
      _b : {};
    for (const [id, msgs] of Object.entries(histories)) {
      const isAgy = sessionEngines[id] === "antigravity" ||
        !sessionEngines[id] && ANTIGRAVITY_ID_HINT.test(id);
      if (!isAgy) continue;
      for (const msg of msgs) {
        if (msg.role === "assistant" && msg.tokens) {
          const inp = (_c = msg.tokens.input) != null ? _c : 0;
          const out = (_d = msg.tokens.output) != null ? _d : 0;
          const ts = msg.timestamp;
          if (!ts || ts >= monthCutoff) {
            month.input += inp;
            month.output += out;
          }
          if (!ts || ts >= weekCutoff) {
            week.input += inp;
            week.output += out;
          }
          if (!ts || ts >= h5Cutoff) {
            h5.input += inp;
            h5.output += out;
          }
        }
      }
    }
    return { h5, week, month };
  }
  /**
   * Build CLI arguments for an Antigravity invocation (exposed for testing)
   */
  buildArgs(req) {
    var _a, _b;
    const s = this.plugin.settings;
    const cfg = this.getConfig();
    const cwd = (_b = (_a = req.cwd) != null ? _a : this.getVaultPath(
      )) != null ? _b : void 0;
    let finalPrompt = req.prompt;
    const BINARY_EXT_REGEX = new RegExp(
        "\\.(png|jpe?g|gif|webp|bmp|svg|ico|pdf|zip|tar|gz|7z|rar|bin|exe|" +
        "dmg|iso|mp3|wav|ogg|mp4|mov|avi|mkv|wasm)$",
      "i"
    );
    const maxInlineBytes = Math.min(
      MAX_INLINE_ATTACHMENT_BYTES,
      Math.max(1, s.maxAttachMB || 20) * 1024 * 1024
    );
    for (const p of req.fileAttachments) {
      const fullPath = !(0, import_path2.isAbsolute)(p) && cwd ? (0,
        import_path2.join)(cwd, p) : p;
      if (BINARY_EXT_REGEX.test(fullPath)) {
        finalPrompt = `[ATTACHMENT PATH: ${fullPath}]

---

` + finalPrompt;
      } else {
        try {
          const st = (0, import_fs2.statSync)(fullPath);
          if (st.size > maxInlineBytes) {
            finalPrompt = `[ATTACHMENT PATH: ${fullPath}]

---

` + finalPrompt;
          } else {
            const content = (0, import_fs2.readFileSync)(fullPath, "utf-8");
            const filename = (0, import_path2.basename)(fullPath);
            finalPrompt = `[ATTACHMENT: ${filename}]
${content}

---

` + finalPrompt;
          }
        } catch (e) {
          finalPrompt = `[ATTACHMENT PATH: ${fullPath}]

---

` + finalPrompt;
        }
      }
    }
    const args = ["-p", finalPrompt, "--output-format", "stream-json"];
    if (s.autoApprove) {
      args.push("--dangerously-skip-permissions");
    }
    const sid = req.sessionId !== void 0 ? req.sessionId : s.sessionId;
    if (sid && !sid.startsWith("ses_")) {
      args.push("--conversation", sid);
    }
    const model = cfg.model || s.antigravityModel || ANTIGRAVITY_DESCRIPTOR
      .defaultModel;
    if (model) {
      args.push("--model", model);
    }
    const effort = cfg.options.effort || s.antigravityEffort;
    const modelEncodesEffort = /-(low|medium|high|xhigh|max)$/i.test(
      model || ""
    );
    if (!modelEncodesEffort && effort) {
      args.push("--effort", effort);
    }
    return args;
  }
  runStream(reqOrPrompt, fileAttachmentsOrCb, maybeCb) {
    var _a, _b;
    const { req, cb } = this.normalizeRunArgs(
      reqOrPrompt,
      fileAttachmentsOrCb,
      maybeCb
    );
    const cwd = (_b = (_a = req.cwd) != null ? _a : this.getVaultPath(
      )) != null ? _b : void 0;
    const args = this.buildArgs({ ...req, cwd });
    const bin = this.resolveBinaryPath(this.getConfig().binary || "agy");
    const streamState = {
      accumulatedText: "",
      emittedQuestionSteps: /* @__PURE__ */ new Set()
    };
    return this.spawnJsonlStream(
      bin,
      args,
      cwd,
      (line) => this.handleLine(line, cb, streamState),
      cb
    );
  }
  handleLine(line, cb, streamState = {
    accumulatedText: ""
  }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r,
      _s, _t, _u;
    if (line.length > MAX_STREAM_LINE_BYTES) {
      (_a = cb.onRaw) == null ? void 0 : _a.call(cb,
        `[omitted event of ${line.length} bytes]
`);
      return;
    }
    let ev;
    try {
      ev = JSON.parse(line);
    } catch (e) {
      (_b = cb.onRaw) == null ? void 0 : _b.call(cb, line + "\n");
      return;
    }
    if (ev.event === "init") {
      const cid = ev.conversation_id;
      if (typeof cid === "string" && cid) {
        cb.onSession(cid);
      }
      (_c = cb.onActivity) == null ? void 0 : _c.call(cb, this.plugin.t(
        "Analyzing and planning..."));
      return;
    }
    if (ev.event === "step_update" && ev.step_update) {
      const su = ev.step_update;
      const cid = su.conversation_id;
      if (typeof cid === "string" && cid) {
        cb.onSession(cid);
      }
      const stepType = su.step_type;
      const stepIndex = su.step_index;
      if (stepType === "user_input") {
        (_d = cb.onActivity) == null ? void 0 : _d.call(cb, this.plugin.t(
          "Analyzing and planning..."));
      }
      if (typeof su.text_delta === "string" && su.text_delta) {
        streamState.accumulatedText += su.text_delta;
        (_e = cb.onActivity) == null ? void 0 : _e.call(cb, this.plugin.t(
          "Writing response..."));
        cb.onText(streamState.accumulatedText, String(stepIndex != null ?
          stepIndex : 0));
      }
      if (typeof su.thought === "string" && su.thought) {
        (_f = cb.onActivity) == null ? void 0 : _f.call(cb, this.plugin.t(
          "Thinking..."));
        cb.onReasoning(su.thought, String(stepIndex != null ? stepIndex : 0));
      } else if (typeof su.reasoning === "string" && su.reasoning) {
        (_g = cb.onActivity) == null ? void 0 : _g.call(cb, this.plugin.t(
          "Thinking..."));
        cb.onReasoning(su.reasoning, String(stepIndex != null ? stepIndex : 0));
      }
      if (stepType === "tool") {
        const toolName = String(su.tool_name || ((_h = su.tool_info) == null ?
          void 0 : _h.name) || "tool");
        const isDone = su.state === "DONE";
        const isError = su.status === "ERROR" || Boolean(su.error);
        const params = (_i = su.tool_info) == null ? void 0 : _i.parameters;
        const durationMs = typeof su.duration_seconds === "number" && su
          .duration_seconds > 0 ? Math.round(su.duration_seconds * 1e3) :
            void 0;
        if (toolName === "ask_question" || toolName === "question") {
          const questions = this.parseAntigravityQuestions(params);
          const qSummary = ((_j = questions[0]) == null ? void 0 : _j
            .question) || this.plugin.t("Agent question");
          const stepKey = String(stepIndex != null ? stepIndex : qSummary);
          if (!streamState.emittedQuestionSteps) {
            streamState.emittedQuestionSteps = /* @__PURE__ */ new Set();
          }
          if (questions.length > 0 && !streamState.emittedQuestionSteps.has(
            stepKey)) {
            streamState.emittedQuestionSteps.add(stepKey);
            (_k = cb.onQuestion) == null ? void 0 : _k.call(cb, questions);
          }
          (_l = cb.onActivity) == null ? void 0 : _l.call(cb, this.plugin.t(
            "Waiting for your answer..."));
          const stepId2 =
            `step-${stepIndex != null ? stepIndex : Date.now()}-${toolName}`;
          cb.onStep({
            id: stepId2,
            tool: toolName,
            title: qSummary,
            state: "completed",
            input: params,
            output: (_m = su.tool_info) == null ? void 0 : _m.output,
            durationMs
          });
          return;
        }
        const title = this.extractAntigravityToolTitle(toolName, params);
        if (!isDone) {
          (_n = cb.onActivity) == null ? void 0 : _n.call(cb, substitute(this
            .plugin.t("Running: $1"), title));
        } else {
          (_o = cb.onActivity) == null ? void 0 : _o.call(cb, this.plugin.t(
            "Analyzing and planning..."));
        }
        const stepId =
          `step-${stepIndex != null ? stepIndex : Date.now()}-${toolName}`;
        cb.onStep({
          id: stepId,
          tool: toolName,
          title,
          state: isDone ? isError ? "error" : "completed" : "running",
          input: params,
          output: (_p = su.tool_info) == null ? void 0 : _p.output,
          durationMs
        });
      }
      return;
    }
    if (ev.event === "result" && ev.result) {
      const res = ev.result;
      if (typeof res.response === "string" && res.response.trim()) {
        streamState.accumulatedText = res.response;
        cb.onText(streamState.accumulatedText, "final");
      }
      const u = (_q = res.usage) != null ? _q : {};
      const inputTokens = (_r = u.input_tokens) != null ? _r : 0;
      const outputTokens = (_s = u.output_tokens) != null ? _s : 0;
      const reasoningTokens = (_t = u.thinking_tokens) != null ? _t : 0;
      const totalTokens = u.total_tokens && u.total_tokens > 0 ? u
        .total_tokens : inputTokens + outputTokens + reasoningTokens;
      cb.onFinish({
        tokens: {
          total: totalTokens,
          input: inputTokens,
          output: outputTokens,
          reasoning: reasoningTokens
        },
        cost: 0
        // Included with Google AI Pro!
      });
      return;
    }
    if (ev.event === "error" || ev.error) {
      const msg = ((_u = ev.error) == null ? void 0 : _u.message) || JSON
        .stringify(ev.error || ev);
      cb.onError(String(msg));
    }
  }
  extractAntigravityToolTitle(toolName, params) {
    if (params && typeof params === "object") {
      if (typeof params.toolSummary === "string" && params.toolSummary.trim()) {
        return params.toolSummary.trim();
      }
      if (typeof params.TargetFile === "string" && params.TargetFile.trim()) {
        return (0, import_path2.basename)(params.TargetFile.trim());
      }
      if (typeof params.AbsolutePath === "string" && params.AbsolutePath.trim(
        )) {
        return (0, import_path2.basename)(params.AbsolutePath.trim());
      }
      if (typeof params.Path === "string" && params.Path.trim()) {
        return (0, import_path2.basename)(params.Path.trim());
      }
      if (typeof params.DirectoryPath === "string" && params.DirectoryPath.trim(
        )) {
        const dp = params.DirectoryPath.trim();
        return (0, import_path2.basename)(dp) || dp;
      }
      if (typeof params.SearchDirectory === "string" && params.SearchDirectory
        .trim()) {
        const dirName = (0, import_path2.basename)(params.SearchDirectory.trim(
          ));
        const q = typeof params.Query === "string" ? params.Query.trim() : "";
        return q ? `"${q}" in ${dirName}` : dirName;
      }
      if (typeof params.Query === "string" && params.Query.trim()) {
        return `"${params.Query.trim()}"`;
      }
      if (typeof params.query === "string" && params.query.trim()) {
        return params.query.trim();
      }
      if (typeof params.Pattern === "string" && params.Pattern.trim()) {
        return params.Pattern.trim();
      }
      if (typeof params.CommandLine === "string" && params.CommandLine.trim()) {
        return params.CommandLine.trim();
      }
      if (typeof params.Role === "string" && params.Role.trim()) {
        return params.Role.trim();
      }
      if (typeof params.toolAction === "string" && params.toolAction.trim()) {
        return params.toolAction.trim();
      }
    }
    return toolName;
  }
  parseAntigravityQuestions(params) {
    var _a;
    if (!params || typeof params !== "object") return [];
    let rawQuestions = params.questions;
    if (typeof rawQuestions === "string") {
      try {
        rawQuestions = JSON.parse(rawQuestions);
      } catch (e) {
        return [];
      }
    }
    if (!Array.isArray(rawQuestions)) return [];
    const result = [];
    for (const item of rawQuestions) {
      if (!item || typeof item !== "object") continue;
      const qObj = item;
      const question = typeof qObj.question === "string" ? qObj.question.trim(
        ) : "";
      if (!question) continue;
      const header = typeof qObj.header === "string" ? qObj.header.trim() :
        void 0;
      const multiple = Boolean((_a = qObj.is_multi_select) != null ? _a : qObj
        .multiple);
      const rawOpts = Array.isArray(qObj.options) ? qObj.options : [];
      const options = [];
      for (const opt of rawOpts) {
        if (typeof opt === "string" && opt.trim()) {
          options.push({ label: opt.trim() });
        } else if (opt && typeof opt === "object") {
          const o = opt;
          const label = typeof o.label === "string" ? o.label.trim() : "";
          if (label) {
            const desc = typeof o.description === "string" ? o.description.trim(
              ) : void 0;
            options.push({ label, description: desc });
          }
        }
      }
      result.push({ header, question, options, multiple });
    }
    return result;
  }
  execSqlite(dbPath, query) {
    return this.execCli("sqlite3", [dbPath, query]);
  }
  getDbPath() {
    return (0, import_path2.join)(
      (0, import_os2.homedir)(),
      ".gemini",
      "antigravity-cli",
      "conversation_summaries.db"
    );
  }
};

// src/providers/opencode/runner.ts
var import_path3 = require("path");

// src/core/types.ts
var DEFAULT_ENGINE_CONFIGS = {
  antigravity: {
    binary: "agy",
    model: "gemini-3.8-flash-high",
    options: {
      effort: "high"
    }
  },
  opencode: {
    binary: "opencode",
    model: "opencode-go/deepseek-v4.1-flash",
    options: {
      agent: ""
    }
  }
};
var DEFAULT_SETTINGS = {
  language: "en",
  engine: "antigravity",
  engines: {
    antigravity: {
      binary: DEFAULT_ENGINE_CONFIGS.antigravity.binary,
      model: DEFAULT_ENGINE_CONFIGS.antigravity.model,
      options: { ...DEFAULT_ENGINE_CONFIGS.antigravity.options }
    },
    opencode: {
      binary: DEFAULT_ENGINE_CONFIGS.opencode.binary,
      model: DEFAULT_ENGINE_CONFIGS.opencode.model,
      options: { ...DEFAULT_ENGINE_CONFIGS.opencode.options }
    }
  },
  binaryPath: "opencode",
  model: "opencode-go/deepseek-v4.1-flash",
  agent: "",
  antigravityBinary: "agy",
  antigravityModel: "gemini-3.8-flash-high",
  antigravityEffort: "high",
  anydocEnabled: true,
  anydocBinary: "anydoc",
  autoApprove: true,
  showThinking: false,
  showToolIO: true,
  sessionId: "",
  sessionEngines: {},
  pinned: [],
  prompts: [],
  dbAutoCleanup: true,
  dbCleanupMaxMB: 5,
  dbCleanupAgeDays: 7,
  maxAttachMB: 20
};
function getEngineConfig(settings, engineId) {
  var _a, _b, _c;
  if (!settings.engines) {
    settings.engines = {};
  }
  if (!settings.engines[engineId]) {
    const def = DEFAULT_ENGINE_CONFIGS[engineId];
    settings.engines[engineId] = {
      binary: (_a = def == null ? void 0 : def.binary) != null ? _a : engineId,
      model: (_b = def == null ? void 0 : def.model) != null ? _b : "",
      options: { ...(_c = def == null ? void 0 : def.options) != null ? _c : {
        } }
    };
  }
  return settings.engines[engineId];
}
function syncSettingsFields(settings) {
  var _a;
  const agy = getEngineConfig(settings, "antigravity");
  const oc = getEngineConfig(settings, "opencode");
  settings.antigravityBinary = agy.binary || DEFAULT_SETTINGS.antigravityBinary;
  settings.antigravityModel = agy.model || DEFAULT_SETTINGS.antigravityModel;
  settings.antigravityEffort = agy.options.effort || DEFAULT_SETTINGS
    .antigravityEffort;
  settings.binaryPath = oc.binary || DEFAULT_SETTINGS.binaryPath;
  settings.model = oc.model;
  settings.agent = (_a = oc.options.agent) != null ? _a : "";
}
function migrateSettings(raw) {
  var _a, _b, _c, _d, _e, _f, _g;
  const data = raw != null ? raw : {};
  const { histories, engines: rawEngines, ...rest } = data;
  const base = Object.assign(
    {},
    DEFAULT_SETTINGS,
    {
      engines: {
        antigravity: {
          binary: DEFAULT_ENGINE_CONFIGS.antigravity.binary,
          model: DEFAULT_ENGINE_CONFIGS.antigravity.model,
          options: { ...DEFAULT_ENGINE_CONFIGS.antigravity.options }
        },
        opencode: {
          binary: DEFAULT_ENGINE_CONFIGS.opencode.binary,
          model: DEFAULT_ENGINE_CONFIGS.opencode.model,
          options: { ...DEFAULT_ENGINE_CONFIGS.opencode.options }
        }
      },
      sessionEngines: {},
      pinned: [],
      prompts: []
    },
    rest
  );
  if (typeof rest.antigravityBinary === "string" && rest.antigravityBinary.trim(
    )) {
    base.engines.antigravity.binary = rest.antigravityBinary.trim();
  }
  if (typeof rest.antigravityModel === "string" && rest.antigravityModel.trim(
    )) {
    base.engines.antigravity.model = rest.antigravityModel.trim();
  }
  if (typeof rest.antigravityEffort === "string" && rest.antigravityEffort.trim(
    )) {
    base.engines.antigravity.options.effort = rest.antigravityEffort.trim();
  }
  if (typeof rest.binaryPath === "string" && rest.binaryPath.trim()) {
    base.engines.opencode.binary = rest.binaryPath.trim();
  }
  if (typeof rest.model === "string") {
    base.engines.opencode.model = rest.model.trim();
  }
  if (typeof rest.agent === "string") {
    base.engines.opencode.options.agent = rest.agent.trim();
  }
  if (rawEngines && typeof rawEngines === "object") {
    for (const [id, cfg] of Object.entries(rawEngines)) {
      if (!cfg || typeof cfg !== "object") continue;
      const existing = (_g = base.engines[id]) != null ? _g : {
        binary: (_b = (_a = DEFAULT_ENGINE_CONFIGS[id]) == null ? void 0 : _a
          .binary) != null ? _b : id,
        model: (_d = (_c = DEFAULT_ENGINE_CONFIGS[id]) == null ? void 0 : _c
          .model) != null ? _d : "",
        options: { ...(_f = (_e = DEFAULT_ENGINE_CONFIGS[id]) == null ?
          void 0 : _e.options) != null ? _f : {} }
      };
      base.engines[id] = {
        binary: typeof cfg.binary === "string" && cfg.binary.trim() ? cfg.binary
          .trim() : existing.binary,
        model: typeof cfg.model === "string" ? cfg.model.trim() : existing
          .model,
        options: {
          ...existing.options,
          ...cfg.options && typeof cfg.options === "object" ? cfg.options : {}
        }
      };
    }
  }
  syncSettingsFields(base);
  return {
    settings: base,
    histories: histories && typeof histories === "object" ? histories : {}
  };
}

// src/providers/opencode/runner.ts
var DEFAULT_CONTEXT_LIMIT = 128e3;
var OPENCODE_DESCRIPTOR = {
  id: "opencode",
  displayName: "OpenCode CLI",
  shortName: "Opencode",
  defaultBinary: "opencode",
  defaultModel: "opencode-go/deepseek-v4.1-flash",
  binaryDesc: 
    "Command or full path to the opencode executable. Usually 'opencode' " +
    "is enough if it is on your PATH.",
  modelDesc: 
    "Pick a model from the opencode list. Default uses the OpenCode Go " +
    "provider.",
  included: false,
  supportsSessions: "api",
  supportsUsageStats: true,
  supportsDbCleanup: true,
  options: [
    {
      key: "agent",
      label: "Agent",
      desc: 
        "The opencode agent to use (e.g. build, plan). Leave empty for the " +
        "default.",
      type: "text",
      placeholder: "e.g. build",
      default: ""
    }
  ]
};
var OpencodeRunner = class extends BaseCliRunner {
  constructor(plugin) {
    super(plugin);
    __publicField(this, "descriptor", OPENCODE_DESCRIPTOR);
    __publicField(this, "id", "opencode");
    __publicField(this, "displayName", "OpenCode CLI");
    __publicField(this, "engine", "opencode");
    __publicField(this, "included", false);
    __publicField(this, "contextLimitCache", /* @__PURE__ */ new Map());
    __publicField(this, "cachedModels", null);
  }
  getConfig() {
    return this.plugin.getEngineConfig("opencode");
  }
  getBin() {
    return this.resolveBinaryPath(this.getConfig().binary || "opencode");
  }
  async getVersion() {
    const out = await this.execCli(this.getBin(), ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from opencode --version");
    return first;
  }
  async listModels(forceRefresh = false) {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const out = await this.execCli(this.getBin(), ["models"]);
    this.cachedModels = out.split("\n").map((l) => l.trim()).filter((l) =>
      /^[a-zA-Z0-9_.:/+-]+$/.test(l)).sort();
    return this.cachedModels;
  }
  async listSessions() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    const sessions = [];
    const seenIds = /* @__PURE__ */ new Set();
    const dbPath = await this.getDbPath();
    if (dbPath) {
      for (const table of ["session_v2", "session"]) {
        try {
          const query = [
            "SELECT id,",
            "replace(replace(COALESCE(title, ''), char(10), ' '), '|', ' '),",
            "time_updated, time_created, project_id, directory",
            `FROM ${table} ORDER BY time_updated DESC LIMIT 60`
          ].join(" ");
          const out = await this.execSqlite(dbPath, query);
          for (const line of out.trim().split(/\r?\n/)) {
            if (!line.trim()) continue;
            const parts = line.split("|");
            const id = (_a = parts[0]) == null ? void 0 : _a.trim();
            if (!id || seenIds.has(id)) continue;
            const rawTitle = ((_b = parts[1]) == null ? void 0 : _b.trim()) ||
              "";
            const updated = parseInt(((_c = parts[2]) == null ? void 0 : _c
              .trim()) || "", 10);
            const created = parseInt(((_d = parts[3]) == null ? void 0 : _d
              .trim()) || "", 10);
            const projectId = ((_e = parts[4]) == null ? void 0 : _e.trim()) ||
              void 0;
            const directory = ((_f = parts[5]) == null ? void 0 : _f.trim()) ||
              void 0;
            sessions.push({
              id,
              title: rawTitle || this.fallbackSessionTitle(id),
              updated: !isNaN(updated) && updated > 0 ? updated : Date.now(),
              created: !isNaN(created) && created > 0 ? created : void 0,
              projectId,
              directory,
              engine: "opencode"
            });
            seenIds.add(id);
          }
          if (sessions.length > 0) break;
        } catch (e) {
        }
      }
    }
    if (sessions.length === 0) {
      try {
        const cwd = (_g = this.getVaultPath()) != null ? _g : void 0;
        const out = await this.execCli(
          this.getBin(),
          ["session", "list", "--format", "json"],
          cwd
        );
        const arr = JSON.parse(out);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (!(item == null ? void 0 : item.id) || seenIds.has(item
              .id)) continue;
            sessions.push({
              ...item,
              title: ((_h = item.title) == null ? void 0 : _h.trim()) || this
                .fallbackSessionTitle(item.id),
              engine: "opencode"
            });
            seenIds.add(item.id);
          }
        }
      } catch (e) {
      }
    }
    const histories = (_i = this.plugin.histories) != null ? _i : {};
    const sessionEngines = (_j = this.plugin.settings.sessionEngines) != null ?
      _j : {};
    for (const [id, msgs] of Object.entries(histories)) {
      if (seenIds.has(id)) continue;
      const isOc = sessionEngines[id] === "opencode" || !sessionEngines[id] &&
        /^ses_/.test(id);
      if (isOc) {
        const lastTs = (_l = (_k = msgs[msgs.length - 1]) == null ? void 0 : _k
          .timestamp) != null ? _l : Date.now();
        sessions.push({
          id,
          title: this.fallbackSessionTitle(id),
          updated: lastTs,
          engine: "opencode"
        });
        seenIds.add(id);
      }
    }
    return sessions;
  }
  fallbackSessionTitle(sessionId) {
    const msgs = this.plugin.getHistory(sessionId);
    const firstUser = msgs.find((m) => m.role === "user" && m.text.trim());
    if (firstUser) {
      const clean = firstUser.text.trim().replace(/\s+/g, " ");
      return clean.length > 48 ? clean.slice(0, 45) + "\u2026" : clean;
    }
    return sessionId;
  }
  async renameSession(sessionId, title) {
    const dbPath = await this.getDbPath();
    if (dbPath) {
      const safeTitle = title.replace(/'/g, "''");
      const safeId = sessionId.replace(/'/g, "''");
      let updatedDb = false;
      for (const table of ["session_v2", "session"]) {
        try {
          const query =
            `UPDATE ${table} SET title = '${safeTitle}' WHERE id = '${safeId}'`;
          await this.execSqlite(dbPath, query);
          updatedDb = true;
        } catch (e) {
        }
      }
      if (updatedDb) return;
    }
    await this.execCli(this.getBin(), [
      "api",
      "PATCH",
      `/api/session/${sessionId}`,
      "-d",
      JSON.stringify({ title })
    ]);
  }
  async deleteSession(sessionId) {
    await this.execCli(this.getBin(), ["session", "delete", sessionId]);
  }
  async getModelContextLimit(model) {
    const cached = this.contextLimitCache.get(model);
    if (cached !== void 0) return cached;
    let limit = 0;
    try {
      limit = await this.fetchModelContextLimit(model);
    } catch (e) {
      limit = 0;
    }
    if (limit > 0) {
      this.contextLimitCache.set(model, limit);
      return limit;
    }
    return DEFAULT_CONTEXT_LIMIT;
  }
  /**
   * Query the local OpenCode API for the model catalogue and read
   * `limit.context`.
   */
  async fetchModelContextLimit(model) {
    var _a;
    const out = await this.execCli(this.getBin(), ["api", "GET", "/api/model"]);
    const parsed = JSON.parse(out);
    const models = Array.isArray(parsed.data) ? parsed.data : [];
    const target = model.split("#")[0];
    const slash = target.indexOf("/");
    const wantProvider = slash >= 0 ? target.slice(0, slash) : "";
    const wantModel = slash >= 0 ? target.slice(slash + 1) : target;
    const match = models.find(
      (m) => m.providerID === wantProvider && m.modelID === wantModel || m
        .modelID === target || m.id === target
    );
    const ctx = (_a = match == null ? void 0 : match.limit) == null ? void 0 :
      _a.context;
    return typeof ctx === "number" && ctx > 0 ? ctx : 0;
  }
  async getSessionTokens(sessionId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r,
      _s;
    let ctxInput = 0;
    let ctxOutput = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalReasoning = 0;
    let totalCost = 0;
    let foundDb = false;
    const dbPath = await this.getDbPath();
    if (dbPath) {
      for (const table of ["session_message", "message"]) {
        try {
          const safeId = sessionId.replace(/'/g, "''");
          const whereClause = table === "session_message" ?
            `session_id = '${safeId}' AND type = 'assistant'` : [
            `session_id = '${safeId}'`,
            "AND json_extract(data, '$.role') = 'assistant'"
          ].join(" ");
          const orderCol = table === "session_message" ? "seq DESC" :
            "time_created DESC";
          const latestQuery = [
            `SELECT json_extract(data, '$.tokens') FROM ${table}`,
            `WHERE ${whereClause} ORDER BY ${orderCol} LIMIT 5`
          ].join(" ");
          const out = await this.execSqlite(dbPath, latestQuery);
          for (const line of out.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "null") continue;
            const tk = JSON.parse(trimmed);
            if (tk) {
              const inp = Number((_a = tk.input) != null ? _a : 0) + Number((
                _c = (_b = tk.cache) == null ? void 0 : _b.read) != null ? _c :
                  0) + Number((_e = (_d = tk.cache) == null ? void 0 : _d
                    .write) != null ? _e : 0);
              const outTok = Number((_f = tk.output) != null ? _f : 0);
              if (inp > 0 || outTok > 0) {
                ctxInput = inp;
                ctxOutput = outTok;
                foundDb = true;
                break;
              }
            }
          }
          if (foundDb) {
            const sumQuery = [
              "SELECT",
              "COALESCE(SUM(json_extract(data, '$.tokens.input')), 0),",
              "COALESCE(SUM(json_extract(data, '$.tokens.output')), 0),",
              "COALESCE(SUM(json_extract(data, '$.tokens.reasoning')), 0),",
              "COALESCE(SUM(json_extract(data, '$.cost')), 0)",
              `FROM ${table} WHERE ${whereClause}`
            ].join(" ");
            const sumOut = await this.execSqlite(dbPath, sumQuery);
            const parts = sumOut.trim().split("|");
            totalInput = Number(parts[0] || 0);
            totalOutput = Number(parts[1] || 0);
            totalReasoning = Number(parts[2] || 0);
            totalCost = Number(parts[3] || 0);
            return {
              input: ctxInput,
              output: ctxOutput,
              totalInput,
              totalOutput,
              totalTokens: totalInput + totalOutput + totalReasoning,
              totalCost
            };
          }
        } catch (e) {
        }
      }
    }
    const history = this.plugin.getHistory(sessionId);
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "assistant" && msg.tokens) {
        const tk = msg.tokens;
        const input = Number((_g = tk.input) != null ? _g : 0) + Number((_i = (
          _h = tk.cache) == null ? void 0 : _h.read) != null ? _i : 0) + Number(
            (_k = (_j = tk.cache) == null ? void 0 : _j.write) != null ? _k :
              0);
        const output = Number((_l = tk.output) != null ? _l : 0);
        if (input > 0 || output > 0) {
          return { input, output };
        }
      }
    }
    try {
      const out = await this.execCli(this.getBin(), [
        "api",
        "GET",
        `/api/session/${sessionId}/message`
      ]);
      const parsed = JSON.parse(out);
      const messages = Array.isArray(parsed.data) ? parsed.data : [];
      for (let i = messages.length - 1; i >= 0; i--) {
        const tk = (_m = messages[i]) == null ? void 0 : _m.tokens;
        if (tk) {
          const input = Number((_n = tk.input) != null ? _n : 0) + Number((_p =
            (_o = tk.cache) == null ? void 0 : _o.read) != null ? _p : 0) +
              Number((_r = (_q = tk.cache) == null ? void 0 : _q
                .write) != null ? _r : 0);
          return { input, output: Number((_s = tk.output) != null ? _s : 0) };
        }
      }
    } catch (e) {
    }
    return { input: 0, output: 0 };
  }
  async pruneOversizedParts(force = false, ignoreAge = false) {
    var _a;
    const s = this.plugin.settings;
    if (!s.dbAutoCleanup && !force) return;
    const dbPath = await this.getDbPath();
    if (!dbPath) return;
    const maxBytes = Math.max(1, s.dbCleanupMaxMB || 5) * 1024 * 1024;
    const ageDays = Math.max(0, (_a = s.dbCleanupAgeDays) != null ? _a : 7);
    const cutoffMs = Date.now() - ageDays * 86400 * 1e3;
    const q = [
      `DELETE FROM part WHERE data LIKE '%"type":"file%'`,
      `AND length(CAST(data AS BLOB)) > ${maxBytes}`,
      ignoreAge ? "" : `AND time_created < ${cutoffMs}`
    ].filter(Boolean).join(" ");
    try {
      await this.execSqlite(dbPath, q);
    } catch (e) {
    }
  }
  async getDbPath() {
    try {
      const out = await this.execCli(this.getBin(), ["debug", "paths"]);
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^\s*db\s+(.+\.db)\s*$/);
        if (m) return m[1].trim();
      }
    } catch (e) {
    }
    return null;
  }
  execSqlite(dbPath, sql) {
    return this.execCli("sqlite3", [dbPath, sql]);
  }
  async getUsageStats() {
    const now = Date.now();
    const [h5, week, month] = await Promise.all([
      this.fetchUsageWindow(now - 5 * 3600 * 1e3, now),
      this.fetchUsageWindow(now - 7 * 24 * 3600 * 1e3, now),
      this.fetchUsageWindow(now - 30 * 24 * 3600 * 1e3, now)
    ]);
    const zero = () => ({ input: 0, output: 0, cost: 0 });
    return {
      h5: h5 != null ? h5 : zero(),
      week: week != null ? week : zero(),
      month: month != null ? month : zero()
    };
  }
  async fetchUsageWindow(from, to) {
    var _a, _b, _c, _d, _e, _f;
    try {
      const out = await this.execCli(this.getBin(), [
        "api",
        "GET",
        "/api/experimental/session/stats",
        "--param",
        `from=${from}`,
        "--param",
        `to=${to}`
      ]);
      const parsed = JSON.parse(out);
      const d = (_a = parsed.data) != null ? _a : {};
      return {
        input: Number((_c = (_b = d.tokens) == null ? void 0 : _b
          .input) != null ? _c : 0),
        output: Number((_e = (_d = d.tokens) == null ? void 0 : _d
          .output) != null ? _e : 0),
        cost: Number((_f = d.cost) != null ? _f : 0)
      };
    } catch (e) {
      return null;
    }
  }
  /**
   * Build CLI arguments for an OpenCode invocation (exposed for testing)
   */
  buildArgs(req) {
    var _a, _b, _c;
    const s = this.plugin.settings;
    const cfg = this.getConfig();
    const cwd = (_b = (_a = req.cwd) != null ? _a : this.getVaultPath(
      )) != null ? _b : void 0;
    const args = ["run", "--format", "json"];
    const sid = req.sessionId !== void 0 ? req.sessionId : s.sessionId;
    if (sid && /^ses/.test(sid)) {
      args.push("--session", sid);
    }
    const model = cfg.model || s.model || DEFAULT_SETTINGS.model;
    args.push("--model", model);
    const agent = (_c = cfg.options.agent) != null ? _c : s.agent;
    if (agent) args.push("--agent", agent);
    if (s.autoApprove) args.push("--auto");
    if (s.showThinking) args.push("--thinking");
    args.push(req.prompt);
    for (const f of req.fileAttachments) {
      const fullPath = !(0, import_path3.isAbsolute)(f) && cwd ? (0,
        import_path3.join)(cwd, f) : f;
      args.push("--file", fullPath);
    }
    return args;
  }
  runStream(reqOrPrompt, fileAttachmentsOrCb, maybeCb) {
    var _a, _b;
    const { req, cb } = this.normalizeRunArgs(
      reqOrPrompt,
      fileAttachmentsOrCb,
      maybeCb
    );
    const cwd = (_b = (_a = req.cwd) != null ? _a : this.getVaultPath(
      )) != null ? _b : void 0;
    const args = this.buildArgs({ ...req, cwd });
    const bin = this.getBin();
    return this.spawnJsonlStream(
      bin,
      args,
      cwd,
      (line) => this.handleLine(line, cb),
      cb
    );
  }
  handleLine(line, cb) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r,
      _s, _t, _u, _v, _w, _x;
    if (line.length > MAX_STREAM_LINE_BYTES) {
      (_a = cb.onRaw) == null ? void 0 : _a.call(cb,
        `[omitted event of ${line.length} bytes]
`);
      return;
    }
    let ev;
    try {
      ev = JSON.parse(line);
    } catch (e) {
      (_b = cb.onRaw) == null ? void 0 : _b.call(cb, line + "\n");
      return;
    }
    const sid = typeof ev.sessionID === "string" ? ev.sessionID : void 0;
    if (sid) cb.onSession(sid);
    const type = ev.type;
    const part = ev.part;
    switch (type) {
      case "step_start":
        (_c = cb.onActivity) == null ? void 0 : _c.call(cb, this.plugin.t(
          "Analyzing and planning..."));
        break;
      case "text":
        if ((part == null ? void 0 : part.type) === "text" && typeof part
          .text === "string") {
          (_d = cb.onActivity) == null ? void 0 : _d.call(cb, this.plugin.t(
            "Writing response..."));
          cb.onText(part.text, String(part.id));
        }
        break;
      case "reasoning":
        if (typeof (part == null ? void 0 : part.text) === "string") {
          (_e = cb.onActivity) == null ? void 0 : _e.call(cb, this.plugin.t(
            "Thinking..."));
          cb.onReasoning(part.text, String(part.id));
        }
        break;
      case "tool_use":
        if ((part == null ? void 0 : part.type) === "tool") {
          const toolName = String(part.tool || "tool");
          const rawState = String(((_f = part.state) == null ? void 0 : _f
            .status) || "completed");
          const input = (_g = part.state) == null ? void 0 : _g.input;
          const startMs = (_i = (_h = part.state) == null ? void 0 : _h
            .time) == null ? void 0 : _i.start;
          const endMs = (_k = (_j = part.state) == null ? void 0 : _j
            .time) == null ? void 0 : _k.end;
          const durationMs = typeof startMs === "number" &&
            typeof endMs === "number" && endMs >= startMs ? endMs - startMs :
              void 0;
          if (toolName === "question" || toolName === "ask_question") {
            const questions = this.parseOpencodeQuestions(input);
            const qTitle = ((_l = questions[0]) == null ? void 0 : _l
              .question) || this.plugin.t("Agent question");
            if (questions.length > 0) {
              (_m = cb.onQuestion) == null ? void 0 : _m.call(cb, questions);
            }
            (_n = cb.onActivity) == null ? void 0 : _n.call(cb, this.plugin.t(
              "Waiting for your answer..."));
            cb.onStep({
              id: String(part.callID || part.id || "step-" + Date.now()),
              tool: toolName,
              title: qTitle,
              state: "completed",
              input,
              output: (_o = part.state) == null ? void 0 : _o.output,
              durationMs
            });
            break;
          }
          const title = this.extractOpencodeToolTitle(
            toolName,
            input,
            (_p = part.state) == null ? void 0 : _p.title
          );
          if (rawState === "running") {
            (_q = cb.onActivity) == null ? void 0 : _q.call(cb, substitute(this
              .plugin.t("Running: $1"), title));
          } else {
            (_r = cb.onActivity) == null ? void 0 : _r.call(cb, this.plugin.t(
              "Analyzing and planning..."));
          }
          cb.onStep({
            id: String(part.callID || part.id || "step-" + Date.now()),
            tool: toolName,
            title,
            state: rawState,
            input,
            output: (_s = part.state) == null ? void 0 : _s.output,
            durationMs
          });
        }
        break;
      case "step_finish": {
        const tk = part == null ? void 0 : part.tokens;
        let normalizedTokens;
        if (tk) {
          const input = Number((_t = tk.input) != null ? _t : 0);
          const output = Number((_u = tk.output) != null ? _u : 0);
          const reasoning = Number((_v = tk.reasoning) != null ? _v : 0);
          const rawTotal = Number((_w = tk.total) != null ? _w : 0);
          const total = rawTotal > 0 ? rawTotal : input + output + reasoning;
          normalizedTokens = {
            ...tk,
            input,
            output,
            reasoning,
            total
          };
        }
        cb.onFinish({
          tokens: normalizedTokens,
          cost: typeof (part == null ? void 0 : part.cost) === "number" ? part
            .cost : void 0
        });
        break;
      }
      case "error":
        cb.onError(this.errorMessage(ev.error));
        break;
      default:
        break;
    }
    if (type !== "reasoning" && (part == null ? void 0 : part
      .type) === "reasoning" && typeof (part == null ? void 0 : part
        .text) === "string") {
      (_x = cb.onActivity) == null ? void 0 : _x.call(cb, this.plugin.t(
        "Thinking..."));
      cb.onReasoning(part.text, String(part.id));
    }
  }
  extractOpencodeToolTitle(toolName, input, stateTitle) {
    const inp = input && typeof input === "object" ? input : null;
    if (inp) {
      if (typeof inp.filePath === "string" && inp.filePath.trim()) {
        return (0, import_path3.basename)(inp.filePath.trim());
      }
      if (typeof inp.path === "string" && inp.path.trim()) {
        return (0, import_path3.basename)(inp.path.trim()) || inp.path.trim();
      }
      if (typeof inp.description === "string" && inp.description.trim()) {
        return inp.description.trim();
      }
      if (typeof inp.command === "string" && inp.command.trim()) {
        return inp.command.trim();
      }
      if (typeof inp.pattern === "string" && inp.pattern.trim()) {
        return inp.pattern.trim();
      }
      if (typeof inp.url === "string" && inp.url.trim()) {
        return inp.url.trim();
      }
      if (typeof inp.query === "string" && inp.query.trim()) {
        return inp.query.trim();
      }
      if (Array.isArray(inp.todos) && inp.todos.length > 0) {
        const doneCount = inp.todos.filter(
          (t) => t && typeof t === "object" && t.status === "completed"
        ).length;
        const tasksWord = this.plugin.t("tasks");
        const doneWord = this.plugin.t("done");
        return `${inp.todos.length} ${tasksWord} (${doneCount} ${doneWord})`;
      }
    }
    if (stateTitle && stateTitle.trim() && stateTitle.trim().toLowerCase(
      ) !== toolName.toLowerCase()) {
      return stateTitle.trim();
    }
    return toolName;
  }
  parseOpencodeQuestions(input) {
    var _a;
    if (!input || typeof input !== "object") return [];
    const inp = input;
    const rawQuestions = inp.questions;
    if (!Array.isArray(rawQuestions)) return [];
    const result = [];
    for (const item of rawQuestions) {
      if (!item || typeof item !== "object") continue;
      const qObj = item;
      const question = typeof qObj.question === "string" ? qObj.question.trim(
        ) : "";
      if (!question) continue;
      const header = typeof qObj.header === "string" ? qObj.header.trim() :
        void 0;
      const multiple = Boolean((_a = qObj.multiple) != null ? _a : qObj
        .is_multi_select);
      const rawOpts = Array.isArray(qObj.options) ? qObj.options : [];
      const options = [];
      for (const opt of rawOpts) {
        if (typeof opt === "string" && opt.trim()) {
          options.push({ label: opt.trim() });
        } else if (opt && typeof opt === "object") {
          const o = opt;
          const label = typeof o.label === "string" ? o.label.trim() : "";
          if (label) {
            const desc = typeof o.description === "string" ? o.description.trim(
              ) : void 0;
            options.push({ label, description: desc });
          }
        }
      }
      result.push({ header, question, options, multiple });
    }
    return result;
  }
  errorMessage(err) {
    var _a;
    if (!err) return this.plugin.t("Unknown error");
    const e = err;
    const msg = ((_a = e.data) == null ? void 0 : _a.message) || e.message ||
      JSON.stringify(err);
    return String(msg);
  }
};

// src/core/registry.ts
var ProviderRegistry = class {
  constructor() {
    __publicField(this, "providers", /* @__PURE__ */ new Map());
  }
  register(provider) {
    this.providers.set(provider.id, provider);
  }
  unregister(id) {
    return this.providers.delete(id);
  }
  get(id) {
    return this.providers.get(id);
  }
  has(id) {
    return this.providers.has(id);
  }
  getAll() {
    return Array.from(this.providers.values());
  }
  getDescriptors() {
    return Array.from(this.providers.values()).map((p) => p.descriptor);
  }
  getAvailableIds() {
    return Array.from(this.providers.keys());
  }
  /**
   * Resolve provider for a specific session or fall back to default
   */
  resolveProvider(activeEngine, sessionId, sessionEngines) {
    const targetEngine = sessionId && (sessionEngines == null ? void 0 :
      sessionEngines[sessionId]) || activeEngine;
    const provider = this.get(targetEngine);
    if (provider) return provider;
    const first = this.getAll()[0];
    if (!first) {
      throw new Error(`No AI agent provider registered in ProviderRegistry.`);
    }
    return first;
  }
};

// src/features/settings/settingsTab.ts
var import_obsidian7 = require("obsidian");
var VaultAgentsSettingTab = class extends import_obsidian7.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  display() {
    var _a;
    const { containerEl } = this;
    const t = (s) => this.plugin.t(s);
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Agents" });
    new import_obsidian7.Setting(containerEl).setName(t("Language")).setDesc(
      t(
          "Interface language. English is the default. Some command names " +
          "update after reloading Obsidian."
      )
    ).addDropdown(
      (dd) => dd.addOption("en", t("English")).addOption("it", t("Italian"))
        .setValue(this.plugin.settings.language).onChange(async (value) => {
        this.plugin.settings.language = value;
        await this.plugin.saveSettings();
        new import_obsidian7.Notice(
          t("Language changed. Reload Obsidian to apply it everywhere.")
        );
        this.display();
      })
    );
    const descriptors = this.plugin.registry.getDescriptors();
    const activeProvider = this.plugin.registry.resolveProvider(
      this.plugin.settings.engine
    );
    const activeDesc = activeProvider.descriptor;
    const activeCfg = this.plugin.getEngineConfig(activeDesc.id);
    new import_obsidian7.Setting(containerEl).setName(t("AI Engine")).setDesc(
      t(
          "Select which AI backend to use. Antigravity connects directly " +
          "to your Google AI Pro subscription with no API key needed."
      )
    ).addDropdown((dd) => {
      for (const desc of descriptors) {
        dd.addOption(desc.id, t(desc.displayName));
      }
      dd.setValue(activeDesc.id);
      dd.onChange(async (value) => {
        this.plugin.settings.engine = value;
        await this.plugin.saveSettings();
        this.display();
      });
    });
    const sectionTitle = activeDesc.id === "antigravity" ? t(
      "Antigravity settings (Google AI Pro)") : activeDesc.id === "opencode" ?
        t("OpenCode settings") : activeDesc.displayName;
    containerEl.createEl("h3", { text: sectionTitle });
    const binaryNameLabel = activeDesc.id === "antigravity" ? t(
      "Antigravity binary path") : t("Binary path");
    new import_obsidian7.Setting(containerEl).setName(binaryNameLabel).setDesc(
      t(activeDesc.binaryDesc)).addText(
      (text) => text.setPlaceholder(activeDesc.defaultBinary).setValue(activeCfg
        .binary).onChange(async (value) => {
        activeCfg.binary = value.trim() || activeDesc.defaultBinary;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian7.Setting(containerEl).setName(t("Model")).setDesc(t(
      activeDesc.modelDesc)).addDropdown((dd) => {
      void this.populateProviderModelDropdown(dd, activeProvider);
    });
    for (const opt of activeDesc.options) {
      const setting = new import_obsidian7.Setting(containerEl).setName(t(opt
        .label)).setDesc(t(opt.desc));
      if (opt.type === "select" && opt.choices) {
        setting.addDropdown((dd) => {
          for (const ch of opt.choices) {
            dd.addOption(ch.value, t(ch.label));
          }
          dd.setValue(activeCfg.options[opt.key] || opt.default);
          dd.onChange(async (val) => {
            activeCfg.options[opt.key] = val;
            await this.plugin.saveSettings();
          });
        });
      } else {
        setting.addText(
          (text) => {
            var _a2;
            return text.setPlaceholder(opt.placeholder ? t(opt.placeholder) :
              "").setValue((_a2 = activeCfg.options[opt.key]) != null ? _a2 :
                opt.default).onChange(async (value) => {
              activeCfg.options[opt.key] = value.trim();
              await this.plugin.saveSettings();
            });
          }
        );
      }
    }
    const binCmd = activeDesc.defaultBinary;
    const testDesc = activeDesc.id === "antigravity" ? t(
      "Run 'agy --version' to verify the binary is reachable.") : activeDesc
        .id === "opencode" ? t(
      "Run 'opencode --version' to verify the binary is reachable.") :
        `Run '${binCmd} --version' to verify the binary is reachable.`;
    const foundPrefix = activeDesc.id === "antigravity" ? t(
      "Antigravity found:") : activeDesc.id === "opencode" ? t(
        "Opencode found:") : `${activeDesc.shortName}:`;
    new import_obsidian7.Setting(containerEl).setName(t("Test connection"))
      .setDesc(testDesc).addButton(
      (btn) => btn.setButtonText(t("Test")).onClick(async () => {
        btn.setDisabled(true);
        btn.setButtonText(t("Testing..."));
        try {
          const version = await activeProvider.getVersion();
          new import_obsidian7.Notice(`${foundPrefix} ${version}`);
        } catch (e) {
          new import_obsidian7.Notice(`${t("Error:")} ${e.message}`);
        } finally {
          btn.setDisabled(false);
          btn.setButtonText(t("Test"));
        }
      })
    );
    containerEl.createEl("h3", { text: t("General settings") });
    new import_obsidian7.Setting(containerEl).setName(t(
      "Auto-approve permissions")).setDesc(
      t(
          "Automatically allow tool permissions (bash, file edits, etc.). " +
          "Turn it off for extra safety."
      )
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoApprove).onChange(
        async (value) => {
        this.plugin.settings.autoApprove = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian7.Setting(containerEl).setName(t("Show reasoning"))
      .setDesc(t("Show the model's reasoning blocks.")).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showThinking).onChange(
        async (value) => {
        this.plugin.settings.showThinking = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian7.Setting(containerEl).setName(t("Show tool details"))
      .setDesc(
      t(
          "Show the input and output of every tool executed during the " +
          "request, in collapsible blocks."
      )
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showToolIO).onChange(
        async (value) => {
        this.plugin.settings.showToolIO = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian7.Setting(containerEl).setName(t("Session ID")).setDesc(
      t(
          "The persistent session id used for the chat. Managed " +
          "automatically. Empty = new session on next message."
      )
    ).addText(
      (text) => text.setPlaceholder(t("(automatic)")).setValue(this.plugin
        .settings.sessionId).onChange(async (value) => {
        this.plugin.settings.sessionId = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian7.Setting(containerEl).setName(t("Reset session"))
      .setDesc(
      t(
        "Clear the saved session and start from scratch on the next message."
      )
    ).addButton(
      (btn) => btn.setButtonText(t("Reset")).onClick(async () => {
        this.plugin.settings.sessionId = "";
        await this.plugin.saveSettings();
        new import_obsidian7.Notice(
          t("Session reset: the next message will start from a new session.")
        );
      })
    );
    containerEl.createEl("h3", { text: t("Document conversion") });
    new import_obsidian7.Setting(containerEl).setName(t(
      "Convert documents with anydoc")).setDesc(
      t(
          "Run anydoc on attached documents (PDF, Word, Excel, etc.) and " +
          "attach them as Markdown instead of the original file."
      )
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.anydocEnabled).onChange(
        async (value) => {
        this.plugin.settings.anydocEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian7.Setting(containerEl).setName(t("Anydoc binary path"))
      .setDesc(
      t(
          "Command or full path to the anydoc executable (npm install -g " +
          "@firecrawl/anydoc)."
      )
    ).addText(
      (text) => text.setPlaceholder("anydoc").setValue(this.plugin.settings
        .anydocBinary).onChange(async (value) => {
        this.plugin.settings.anydocBinary = value.trim() || "anydoc";
        await this.plugin.saveSettings();
      })
    );
    if (activeDesc.supportsDbCleanup && activeProvider.pruneOversizedParts) {
      containerEl.createEl("h3", { text: t("Database self-cleanup") });
      new import_obsidian7.Setting(containerEl).setName(t(
        "Enable automatic cleanup")).setDesc(
        t(
            "Periodically remove large file attachments from the opencode " +
            "database (opencode.db), which would otherwise bloat it. Only " +
            "file attachments older than the minimum age and larger than " +
            "the max size are removed; conversation text is never touched."
        )
      ).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.dbAutoCleanup)
          .onChange(async (value) => {
          this.plugin.settings.dbAutoCleanup = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian7.Setting(containerEl).setName(t("Max part size (MB)"))
        .setDesc(
        t("File attachments larger than this (in the database) are removed.")
      ).addText(
        (text) => text.setPlaceholder("5").setValue(String(this.plugin.settings
          .dbCleanupMaxMB)).onChange(async (value) => {
          const n = parseInt(value, 10);
          const val = Number.isFinite(n) && n > 0 ? n : 5;
          this.plugin.settings.dbCleanupMaxMB = val;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian7.Setting(containerEl).setName(t("Minimum age (days)"))
        .setDesc(
        t(
            "Only attachments older than this are removed, so recent files " +
            "stay available."
        )
      ).addText(
        (text) => text.setPlaceholder("7").setValue(String(this.plugin.settings
          .dbCleanupAgeDays)).onChange(async (value) => {
          const n = parseInt(value, 10);
          const val = Number.isFinite(n) && n >= 0 ? n : 7;
          this.plugin.settings.dbCleanupAgeDays = val;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian7.Setting(containerEl).setName(t(
        "Max attachment size (MB)")).setDesc(
        t(
            "When anydoc fails to convert a document, files larger than " +
            "this are not attached to the request, to avoid storing " +
            "unusable copies in the database."
        )
      ).addText(
        (text) => text.setPlaceholder("20").setValue(String(this.plugin.settings
          .maxAttachMB)).onChange(async (value) => {
          const n = parseInt(value, 10);
          const val = Number.isFinite(n) && n > 0 ? n : 20;
          this.plugin.settings.maxAttachMB = val;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian7.Setting(containerEl).setName(t("Run cleanup now"))
        .setDesc(
        t("Remove oversized file attachments immediately, regardless of age.")
      ).addButton(
        (btn) => btn.setButtonText(t("Cleanup")).onClick(async () => {
          var _a2;
          btn.setDisabled(true);
          btn.setButtonText(t("Cleaning..."));
          try {
            await ((_a2 = activeProvider.pruneOversizedParts) == null ?
              void 0 : _a2.call(activeProvider, true, true));
            new import_obsidian7.Notice(t("Cleanup done."));
          } catch (e) {
            new import_obsidian7.Notice(`${t("Error:")} ${e.message}`);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText(t("Cleanup"));
          }
        })
      );
    }
    containerEl.createEl("h3", { text: t("Prompt templates") });
    containerEl.createEl("p", {
      text: t(
          "Save reusable prompt templates. In the chat, type /prompt to " +
          "quickly insert them into the composer."
      ),
      cls: "setting-item-description"
    });
    const prompts = (_a = this.plugin.settings.prompts) != null ? _a : [];
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      const desc = p.text.length > 90 ? p.text.slice(0, 87) + "\u2026" : p.text;
      const s = new import_obsidian7.Setting(containerEl).setName(p.name || t(
        "(untitled)")).setDesc(desc);
      s.addButton(
        (b) => b.setButtonText(t("Edit")).onClick(() => this.editPrompt(i))
      );
      s.addButton(
        (b) => b.setButtonText(t("Delete")).setWarning().onClick(async () => {
          prompts.splice(i, 1);
          this.plugin.settings.prompts = prompts;
          await this.plugin.saveSettings();
          this.display();
        })
      );
    }
    new import_obsidian7.Setting(containerEl).addButton(
      (b) => b.setButtonText(t("Add prompt")).setCta().onClick(() => this
        .editPrompt(-1))
    );
  }
  editPrompt(index) {
    var _a;
    const prompts = (_a = this.plugin.settings.prompts) != null ? _a : [];
    const existing = index >= 0 ? prompts[index] : null;
    new PromptModal(
      this.app,
      this.plugin,
      existing ? existing.name : "",
      existing ? existing.text : "",
      (name, text) => {
        if (existing) {
          existing.name = name;
          existing.text = text;
        } else {
          prompts.push({ name, text });
        }
        void this.plugin.saveSettings();
        this.display();
      }
    ).open();
  }
  async populateProviderModelDropdown(dd, provider) {
    const t = (s) => this.plugin.t(s);
    const desc = provider.descriptor;
    const cfg = this.plugin.getEngineConfig(desc.id);
    const cur = cfg.model || desc.defaultModel;
    const seen = /* @__PURE__ */ new Set();
    const addOption = (val, display) => {
      if (seen.has(val)) return;
      seen.add(val);
      dd.addOption(val, display);
    };
    if (!desc.included) {
      addOption("", t("(default from opencode)"));
      if (cur) {
        const suffix = cur.includes("/") ? "" : ` ${t("(custom)")}`;
        addOption(cur, cur + suffix);
      }
    }
    try {
      const models = await provider.listModels();
      for (const m of models) addOption(m, m);
      dd.setValue(cur || "");
    } catch (e) {
      if (desc.id === "antigravity") {
        addOption("gemini-3.8-flash-high", "Gemini 3.8 Flash (High)");
        addOption("claude-opus-5-5-high", "Claude Opus 5.5 (High)");
        addOption("claude-sonnet-5-5-high", "Claude Sonnet 5.5 (High)");
      } else {
        const opt = dd.selectEl.createEl("option");
        opt.value = "__error__";
        opt.textContent = `${t("Error:")} ${e.message}`;
        opt.disabled = true;
      }
      dd.setValue(cur || "");
    }
    dd.onChange(async (val) => {
      cfg.model = val;
      await this.plugin.saveSettings();
    });
  }
};

// src/main.ts
var OpencodePlugin = class extends import_obsidian8.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings");
    __publicField(this, "histories", {});
    __publicField(this, "registry");
    __publicField(this, "opencodeRunner");
    __publicField(this, "antigravityRunner");
    __publicField(this, "saveTimer", null);
  }
  getRunnerForSession(sessionId) {
    return this.registry.resolveProvider(
      this.settings.engine,
      sessionId,
      this.settings.sessionEngines
    );
  }
  getEngineConfig(engineId) {
    return getEngineConfig(this.settings, engineId);
  }
  getVaultPath() {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof import_obsidian8.FileSystemAdapter) {
      return adapter.getBasePath();
    }
    return null;
  }
  async onload() {
    const raw = await this.loadData();
    const migrated = migrateSettings(raw);
    this.settings = migrated.settings;
    this.histories = migrated.histories;
    this.opencodeRunner = new OpencodeRunner(this);
    this.antigravityRunner = new AntigravityRunner(this);
    this.registry = new ProviderRegistry();
    this.registry.register(this.opencodeRunner);
    this.registry.register(this.antigravityRunner);
    void this.opencodeRunner.pruneOversizedParts();
    const t = this.t.bind(this);
    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));
    this.addRibbonIcon("bot", t("New Vault Agents chat"), () => {
      void this.openNewChatView();
    });
    this.addCommand({
      id: "open-chat",
      name: t("Open Vault Agents chat"),
      callback: () => this.openChatView()
    });
    this.addCommand({
      id: "new-chat",
      name: t("New Vault Agents chat"),
      callback: () => this.openNewChatView()
    });
    this.addCommand({
      id: "continue-new-session",
      name: t("Continue in a new session (by summarizing)"),
      callback: async () => {
        const chat = await this.openChatView();
        chat.continueInNewSession();
      }
    });
    this.addCommand({
      id: "send-selection",
      name: t("Send selection to agent"),
      editorCallback: (editor, view) => {
        const selection = editor.getSelection();
        if (!selection.trim()) {
          new import_obsidian8.Notice(t("No text selected"));
          return;
        }
        const label = view.file ? view.file.path : "selection";
        this.openChatView().then((chat) => {
          chat.setContext({ label, content: selection });
          chat.focusInput();
        });
      }
    });
    this.addCommand({
      id: "use-current-note",
      name: t("Use the current note as context"),
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new import_obsidian8.Notice(t("No active note"));
          return;
        }
        const content = await this.app.vault.cachedRead(file);
        const chat = await this.openChatView();
        chat.setContext({ label: file.path, content });
        chat.focusInput();
      }
    });
    this.addCommand({
      id: "analyze-current-note",
      name: t("Analyze the current note with agent"),
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new import_obsidian8.Notice(t("No active note"));
          return;
        }
        const content = await this.app.vault.cachedRead(file);
        const chat = await this.openChatView();
        chat.setContext({ label: file.path, content });
        chat.sendText(
          t(
              "Analyze the content of the attached note below: provide a " +
              "summary, key points, possible links with other vault notes " +
              "and suggestions to develop it."
          )
        );
      }
    });
    this.addCommand({
      id: "reset-session",
      name: t("Reset the active session"),
      callback: async () => {
        this.settings.sessionId = "";
        await this.saveSettings();
        new import_obsidian8.Notice(t("Session reset."));
      }
    });
    this.addSettingTab(new VaultAgentsSettingTab(this.app, this));
  }
  // Translate a UI string according to the selected language.
  t(text) {
    var _a, _b;
    return translate((_b = (_a = this.settings) == null ? void 0 : _a
      .language) != null ? _b : "en", text);
  }
  async openChatView() {
    const existing = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return existing.view;
    }
    return this.openNewChatView(false);
  }
  async openNewChatView(resetSession = true) {
    const { workspace } = this.app;
    const hadExistingChat = workspace.getLeavesOfType(CHAT_VIEW_TYPE)
      .length > 0;
    let leaf;
    try {
      leaf = workspace.getLeaf("split", "vertical");
    } catch (e) {
      leaf = workspace.getLeaf(true);
    }
    if (resetSession && hadExistingChat) {
      this.settings.sessionId = "";
    }
    await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
    await workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (resetSession && hadExistingChat) {
      view.startNewSession(true);
    }
    return view;
  }
  onunload() {
    void this.flushSave();
    if (this.registry) {
      for (const provider of this.registry.getAll()) {
        provider.killAll();
      }
    }
  }
  scheduleSave() {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      syncSettingsFields(this.settings);
      void this.saveData({ ...this.settings, histories: this.histories });
    }, 500);
  }
  async flushSave() {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    syncSettingsFields(this.settings);
    await this.saveData({ ...this.settings, histories: this.histories });
  }
  getHistory(sessionId) {
    var _a;
    return (_a = this.histories[sessionId]) != null ? _a : [];
  }
  async appendHistory(sessionId, msg) {
    var _a, _b, _c, _d;
    if (!sessionId) return;
    const cap = (s) => s && s.length > 5e4 ? s.slice(0, 5e4) + "\u2026" : s;
    const cloned = msg.role === "assistant" ? {
      ...msg,
      text: (_a = cap(msg.text)) != null ? _a : "",
      reasoning: cap(msg.reasoning),
      timestamp: (_b = msg.timestamp) != null ? _b : Date.now()
    } : {
      ...msg,
      text: (_c = cap(msg.text)) != null ? _c : "",
      timestamp: (_d = msg.timestamp) != null ? _d : Date.now()
    };
    if (!this.histories[sessionId]) this.histories[sessionId] = [];
    const arr = this.histories[sessionId];
    arr.push(cloned);
    if (arr.length > 100) arr.splice(0, arr.length - 100);
    this.scheduleSave();
  }
  async deleteHistory(sessionId) {
    delete this.histories[sessionId];
    this.scheduleSave();
  }
  async saveSettings() {
    await this.flushSave();
  }
};
