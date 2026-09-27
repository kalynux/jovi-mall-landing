/**
 * Builds the ten Wi-Mall contact & careers Google Forms (5 languages each)
 * from the build sheet at https://claude.ai/artifact/Y4ibJS5HJRhfGwXuTDuvFP,
 * whose wording is copied verbatim into SPEC at the bottom of this file.
 *
 * How to run: paste this whole file into a new project at
 * https://script.google.com, choose `buildAll` in the toolbar, press Run.
 *
 * It is safe to run again. Finished forms are skipped, and it stops itself
 * before Google's 6-minute limit, so if the log says "press Run again", do.
 *
 * What it does, per form: creates it in a "Wi-Mall forms" Drive folder, adds
 * every question with its required switch and validation (custom error text
 * included), sets the confirmation message, turns off email collection,
 * "Limit to 1 response", response editing and the public results summary,
 * publishes it, and links its responses to one spreadsheet per form type with
 * one tab per language (EN, FR, PT, ES, AR). Then `checkForms` fetches each
 * form's public link with no Google sign-in, the way a site visitor would,
 * and prints the ten lines for the landing app's .env.production.
 *
 * What it can't do (Apps Script has no switch for it): turn on "Get email
 * notifications for new responses". Do that by hand in each form.
 */

const FOLDER_NAME = 'Wi-Mall forms';
const SPREADSHEET_NAMES = {
  contact: 'Wi-Mall contact responses',
  careers: 'Wi-Mall careers responses',
};
const KINDS = ['contact', 'careers'];
const LOCALES = ['en', 'fr', 'pt', 'es', 'ar'];
// Stop starting new forms after this long; Google kills a run at 6 minutes.
const TIME_BUDGET_MS = 4.5 * 60 * 1000;

const props = PropertiesService.getScriptProperties();

/** Builds whatever isn't built yet, then checks all ten forms. */
function buildAll() {
  const started = Date.now();
  const folder = getFolder_();

  for (const kind of KINDS) {
    const spreadsheetId = getSpreadsheet_(kind, folder);
    for (const locale of LOCALES) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        console.log('Stopped early so Google doesn\'t cut this run off mid-form. Press Run again to continue.');
        return;
      }
      buildForm_(kind, locale, folder);
      linkForm_(kind, locale, spreadsheetId);
    }
    tidyTabs_(spreadsheetId);
  }

  console.log('All ten forms are built. Checking them the way a visitor would…');
  checkForms();
}

/**
 * Opens each form's public link with no Google sign-in and prints the
 * .env.production lines. Run it again after changing any sharing setting.
 */
function checkForms() {
  const envLines = [];
  let problems = 0;

  for (const { form: kind, locale, var: envVar } of SPEC.envVars) {
    const saved = props.getProperty(formKey_(kind, locale));
    if (!saved) {
      console.log(fileName_(kind, locale) + ': not built yet. Run buildAll.');
      problems++;
      continue;
    }
    const url = FormApp.openById(saved.split('|')[0]).getPublishedUrl();
    const status = publicStatus_(url);
    if (!status.ok) problems++;
    console.log(fileName_(kind, locale) + ': ' + status.text);
    envLines.push(envVar + '=' + url);
  }

  console.log('Lines for .env.production:\n\n' + envLines.join('\n') + '\n');
  console.log(problems === 0
    ? 'Every form opens without a sign-in. Last step by hand: in each form, Responses → ⋮ → "Get email notifications for new responses".'
    : problems + ' form(s) need attention: see the lines above marked ✗ or ?.');
}

/**
 * Makes this script forget what it built, so buildAll starts from scratch.
 * It does NOT delete anything: bin the old "Wi-Mall forms" folder yourself
 * first, or you will end up with two sets of forms.
 */
function forgetBuild() {
  props.deleteAllProperties();
  console.log('Forgotten. The next buildAll creates a new folder, two new spreadsheets and ten new forms.');
}

// ---------------------------------------------------------------------------

function formKey_(kind, locale) {
  return 'form:' + kind + ':' + locale;
}

function fileName_(kind, locale) {
  return 'Wi-Mall ' + kind + ' (' + locale.toUpperCase() + ')';
}

function getFolder_() {
  const id = props.getProperty('folder');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('folder', folder.getId());
  return folder;
}

function getSpreadsheet_(kind, folder) {
  const key = 'spreadsheet:' + kind;
  const id = props.getProperty(key);
  if (id) return id;
  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAMES[kind]);
  DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);
  // The empty first tab goes once a form's tab exists. Remember it by id:
  // its name depends on the account's language ("Sheet1", "Feuille 1"…).
  props.setProperty(key + ':blank', String(spreadsheet.getSheets()[0].getSheetId()));
  props.setProperty(key, spreadsheet.getId());
  return spreadsheet.getId();
}

function buildForm_(kind, locale, folder) {
  const key = formKey_(kind, locale);
  const saved = props.getProperty(key);
  if (saved) {
    const [id, state] = saved.split('|');
    if (state !== 'building') return;
    // An earlier run died half-way through this form: bin it and start over.
    DriveApp.getFileById(id).setTrashed(true);
  }

  const spec = SPEC.forms[kind][locale];
  const name = fileName_(kind, locale);
  const form = FormApp.create(name);
  props.setProperty(key, form.getId() + '|building');

  const file = DriveApp.getFileById(form.getId());
  file.moveTo(folder);

  form.setTitle(spec.formTitle)
    .setDescription(spec.formDescription)
    .setConfirmationMessage(spec.confirmationMessage);
  file.setName(name);

  // Every one of these defaults to the value we want, so a failure only
  // means "check it by hand", never a broken form.
  attempt_(name, 'turn off email collection', () => {
    if (FormApp.EmailCollectionType && typeof form.setEmailCollectionType === 'function') {
      form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT);
    } else {
      form.setCollectEmail(false);
    }
  });
  attempt_(name, 'turn off "Limit to 1 response"', () => form.setLimitOneResponsePerUser(false));
  attempt_(name, 'turn off "Allow response editing"', () => form.setAllowResponseEdits(false));
  attempt_(name, 'turn off "View results summary"', () => form.setPublishingSummary(false));
  // Google Workspace accounts only; a personal Gmail form has no such setting.
  attempt_(name, 'remove the organisation-only restriction', () => form.setRequireLogin(false), true);

  for (const question of spec.questions) addQuestion_(form, question);

  if (typeof form.setPublished === 'function') {
    attempt_(name, 'publish it (click Publish in the form)', () => form.setPublished(true));
  }
  attempt_(name, 'turn on "Accepting responses"', () => form.setAcceptingResponses(true));

  props.setProperty(key, form.getId() + '|built');
  console.log('Built ' + name + ' (' + spec.questions.length + ' questions)');
}

function addQuestion_(form, q) {
  let item;
  switch (q.type) {
    case 'Short answer':
      item = form.addTextItem();
      break;
    case 'Paragraph':
      item = form.addParagraphTextItem();
      break;
    case 'Multiple choice':
      item = form.addMultipleChoiceItem().setChoiceValues(q.options).showOtherOption(q.otherOption);
      break;
    case 'Checkboxes':
      item = form.addCheckboxItem().setChoiceValues(q.options).showOtherOption(q.otherOption);
      break;
    case 'Dropdown':
      if (q.otherOption) throw new Error('A dropdown can\'t have an "Other" option (' + q.id + ')');
      item = form.addListItem().setChoiceValues(q.options);
      break;
    case 'Date':
      item = form.addDateItem().setIncludesYear(true);
      break;
    default:
      throw new Error('Unknown question type "' + q.type + '" (' + q.id + ')');
  }
  item.setTitle(q.title).setRequired(q.required);
  if (q.helpText) item.setHelpText(q.helpText);
  if (q.validation) item.setValidation(validation_(q));
}

function validation_(q) {
  const v = q.validation;
  const text = () => (q.type === 'Paragraph'
    ? FormApp.createParagraphTextValidation()
    : FormApp.createTextValidation()
  ).setHelpText(v.errorText);

  switch (v.menu) {
    case 'Length → Maximum character count':
      return text().requireTextLengthLessThanOrEqualTo(Number(v.value)).build();
    case 'Regular expression → Matches':
      return text().requireTextMatchesPattern(v.value).build();
    case 'Text → Email':
      return FormApp.createTextValidation().setHelpText(v.errorText).requireTextIsEmail().build();
    case 'Text → URL':
      return FormApp.createTextValidation().setHelpText(v.errorText).requireTextIsUrl().build();
    case 'Select at least':
      return FormApp.createCheckboxValidation().setHelpText(v.errorText)
        .requireSelectAtLeast(Number(v.value)).build();
    default:
      throw new Error('Unknown validation "' + v.menu + '" (' + q.id + ')');
  }
}

function linkForm_(kind, locale, spreadsheetId) {
  const key = formKey_(kind, locale);
  const [formId, state] = props.getProperty(key).split('|');
  if (state === 'linked') return;

  const name = fileName_(kind, locale);
  const tabName = locale.toUpperCase();
  let before = null;
  if (state !== 'linking') {
    before = SpreadsheetApp.openById(spreadsheetId).getSheets().map((s) => s.getSheetId());
    props.setProperty(key, formId + '|linking');
    FormApp.openById(formId).setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);
  }

  const tab = waitForTab_(spreadsheetId, formId, before);
  if (tab) {
    tab.setName(tabName);
  } else {
    console.warn('  ! ' + name + ' is linked to "' + SPREADSHEET_NAMES[kind]
      + '", but its tab didn\'t show up. Rename its "Form Responses" tab to ' + tabName + ' yourself.');
  }
  removeBlankTab_(kind, spreadsheetId);
  props.setProperty(key, formId + '|linked');
}

// Google adds the form's tab a moment after linking, so look for it a few times.
function waitForTab_(spreadsheetId, formId, before) {
  for (let i = 0; i < 15; i++) {
    SpreadsheetApp.flush();
    const sheets = SpreadsheetApp.openById(spreadsheetId).getSheets();
    const tab = sheets.find((s) => (s.getFormUrl() || '').indexOf(formId) !== -1)
      || (before ? sheets.find((s) => before.indexOf(s.getSheetId()) === -1) : null);
    if (tab) return tab;
    Utilities.sleep(1000);
  }
  return null;
}

function removeBlankTab_(kind, spreadsheetId) {
  const key = 'spreadsheet:' + kind + ':blank';
  const blankId = props.getProperty(key);
  if (!blankId) return;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const blank = spreadsheet.getSheets().find((s) => String(s.getSheetId()) === blankId);
  if (blank && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(blank);
  props.deleteProperty(key);
}

// Linked tabs arrive newest-first; put them back in EN, FR, PT, ES, AR order.
function tidyTabs_(spreadsheetId) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  LOCALES.forEach((locale, i) => {
    const tab = spreadsheet.getSheetByName(locale.toUpperCase());
    if (!tab) return;
    spreadsheet.setActiveSheet(tab);
    spreadsheet.moveActiveSheet(i + 1);
  });
}

function attempt_(formName, what, fn, quiet) {
  try {
    fn();
  } catch (e) {
    if (!quiet) console.warn('  ! ' + formName + ': couldn\'t ' + what + ' (' + e.message + '). Set it by hand.');
  }
}

// UrlFetchApp sends no Google cookies, so this sees what a signed-out visitor sees.
function publicStatus_(url) {
  const res = UrlFetchApp.fetch(url, { followRedirects: false, muteHttpExceptions: true });
  const code = res.getResponseCode();
  const headers = res.getHeaders();
  const location = String(Object.keys(headers)
    .filter((k) => k.toLowerCase() === 'location')
    .map((k) => headers[k])[0] || '');

  if (code === 200 && res.getContentText().indexOf('FB_PUBLIC_LOAD_DATA_') !== -1) {
    return { ok: true, text: 'opens without a sign-in ✓' };
  }
  if (code === 401 || /accounts\.google\.com|ServiceLogin/.test(location)) {
    return { ok: false, text: 'asks visitors to sign in ✗ (Published → Manage → General access → "Anyone with the link")' };
  }
  if (/closedform/.test(location)) {
    return { ok: false, text: 'not accepting responses ✗ (Published → turn on "Accepting responses")' };
  }
  return { ok: false, text: 'unclear (HTTP ' + code + ') ? Check that it is published, then open its link in a private window' };
}

// ---------------------------------------------------------------------------
// Copied verbatim from the build sheet. Change the wording here, not above.

const SPEC = {
  "envVars": [
    {
      "form": "contact",
      "locale": "en",
      "var": "NEXT_PUBLIC_CONTACT_FORM_URL_EN"
    },
    {
      "form": "contact",
      "locale": "fr",
      "var": "NEXT_PUBLIC_CONTACT_FORM_URL_FR"
    },
    {
      "form": "contact",
      "locale": "pt",
      "var": "NEXT_PUBLIC_CONTACT_FORM_URL_PT"
    },
    {
      "form": "contact",
      "locale": "es",
      "var": "NEXT_PUBLIC_CONTACT_FORM_URL_ES"
    },
    {
      "form": "contact",
      "locale": "ar",
      "var": "NEXT_PUBLIC_CONTACT_FORM_URL_AR"
    },
    {
      "form": "careers",
      "locale": "en",
      "var": "NEXT_PUBLIC_CAREERS_FORM_URL_EN"
    },
    {
      "form": "careers",
      "locale": "fr",
      "var": "NEXT_PUBLIC_CAREERS_FORM_URL_FR"
    },
    {
      "form": "careers",
      "locale": "pt",
      "var": "NEXT_PUBLIC_CAREERS_FORM_URL_PT"
    },
    {
      "form": "careers",
      "locale": "es",
      "var": "NEXT_PUBLIC_CAREERS_FORM_URL_ES"
    },
    {
      "form": "careers",
      "locale": "ar",
      "var": "NEXT_PUBLIC_CAREERS_FORM_URL_AR"
    }
  ],
  "forms": {
    "contact": {
      "en": {
        "formTitle": "Contact Wi-Mall",
        "formDescription": "Selling, delivering, buying, or simply curious — this reaches us. One form for everything: it reaches the same place whatever you are asking about. Many questions already have an answer in the FAQ at wi-mall.com/faq.",
        "confirmationMessage": "Thank you. Your message has reached the Wi-Mall team, and any reply will go to the email address you gave.",
        "questions": [
          {
            "id": "full_name",
            "title": "Full name",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "Use 80 characters or fewer."
            }
          },
          {
            "id": "email",
            "title": "Email",
            "helpText": "The address we should reply to.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "Enter a valid email address, like you@example.com."
            }
          },
          {
            "id": "whatsapp",
            "title": "WhatsApp or phone number",
            "helpText": "Optional. Start with + and your country code, for example +237 for Cameroon.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "Start with + and the country code, then the number: 8 to 15 digits in all, spaces allowed."
            }
          },
          {
            "id": "role",
            "title": "I am a…",
            "helpText": null,
            "type": "Multiple choice",
            "required": true,
            "options": [
              "Customer",
              "Vendor",
              "Delivery agency",
              "Delivery agent",
              "Partner or press",
              "Other"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "topic",
            "title": "What is it about?",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "A general question",
              "My account or signing in",
              "An order or a payment",
              "Selling on Wi-Mall",
              "Delivering on Wi-Mall",
              "A partnership",
              "Press",
              "Something else"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "message",
            "title": "Your message",
            "helpText": "If it is about an order, include the order reference.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{20,1000}$",
              "errorText": "Write between 20 and 1,000 characters."
            }
          },
          {
            "id": "consent",
            "title": "Consent",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "I agree to be contacted about this request, using the details I have given in this form."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "Tick the box so we can reply to you."
            }
          }
        ]
      },
      "fr": {
        "formTitle": "Contacter Wi-Mall",
        "formDescription": "Vendre, livrer, acheter, ou simplement curieux — ce message nous parvient. Un seul formulaire pour tout : il arrive au même endroit quel que soit le sujet. Beaucoup de questions ont déjà leur réponse dans la FAQ : wi-mall.com/fr/faq.",
        "confirmationMessage": "Merci. Votre message est bien parvenu à l'équipe Wi-Mall, et toute réponse sera envoyée à l'adresse e-mail que vous avez indiquée.",
        "questions": [
          {
            "id": "full_name",
            "title": "Nom complet",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "80 caractères maximum."
            }
          },
          {
            "id": "email",
            "title": "E-mail",
            "helpText": "L'adresse à laquelle vous répondre.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "Saisissez une adresse e-mail valide, par exemple vous@exemple.com."
            }
          },
          {
            "id": "whatsapp",
            "title": "Numéro WhatsApp ou de téléphone",
            "helpText": "Facultatif. Commencez par + et l'indicatif du pays, par exemple +237 pour le Cameroun.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "Commencez par + et l'indicatif du pays, puis le numéro : 8 à 15 chiffres au total, espaces autorisés."
            }
          },
          {
            "id": "role",
            "title": "Je suis…",
            "helpText": null,
            "type": "Multiple choice",
            "required": true,
            "options": [
              "Client",
              "Vendeur",
              "Agence de livraison",
              "Livreur",
              "Partenaire ou presse",
              "Autre"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "topic",
            "title": "De quoi s'agit-il ?",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Une question générale",
              "Mon compte ou la connexion",
              "Une commande ou un paiement",
              "Vendre sur Wi-Mall",
              "Livrer avec Wi-Mall",
              "Un partenariat",
              "Presse",
              "Autre chose"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "message",
            "title": "Votre message",
            "helpText": "S'il s'agit d'une commande, indiquez sa référence.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{20,1000}$",
              "errorText": "Écrivez entre 20 et 1 000 caractères."
            }
          },
          {
            "id": "consent",
            "title": "Consentement",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "J'accepte d'être contacté(e) au sujet de cette demande, avec les coordonnées indiquées dans ce formulaire."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "Cochez la case pour que nous puissions vous répondre."
            }
          }
        ]
      },
      "pt": {
        "formTitle": "Contactar a Wi-Mall",
        "formDescription": "A vender, a entregar, a comprar, ou apenas curioso — isto chega até nós. Um formulário para tudo: chega ao mesmo sítio seja qual for o assunto. Muitas perguntas já têm resposta nas perguntas frequentes: wi-mall.com/pt/faq.",
        "confirmationMessage": "Obrigado. A sua mensagem chegou à equipa da Wi-Mall, e qualquer resposta será enviada para o endereço de e-mail que indicou.",
        "questions": [
          {
            "id": "full_name",
            "title": "Nome completo",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "No máximo 80 caracteres."
            }
          },
          {
            "id": "email",
            "title": "E-mail",
            "helpText": "O endereço para onde lhe devemos responder.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "Introduza um endereço de e-mail válido, por exemplo voce@exemplo.com."
            }
          },
          {
            "id": "whatsapp",
            "title": "Número de WhatsApp ou de telefone",
            "helpText": "Opcional. Comece por + e o indicativo do país, por exemplo +237 para os Camarões.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "Comece por + e o indicativo do país, seguido do número: 8 a 15 algarismos no total, pode usar espaços."
            }
          },
          {
            "id": "role",
            "title": "Sou…",
            "helpText": null,
            "type": "Multiple choice",
            "required": true,
            "options": [
              "Cliente",
              "Vendedor",
              "Agência de entregas",
              "Entregador",
              "Parceiro ou imprensa",
              "Outro"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "topic",
            "title": "Qual é o assunto?",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Uma pergunta geral",
              "A minha conta ou o início de sessão",
              "Uma encomenda ou um pagamento",
              "Vender na Wi-Mall",
              "Entregar com a Wi-Mall",
              "Uma parceria",
              "Imprensa",
              "Outro assunto"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "message",
            "title": "A sua mensagem",
            "helpText": "Se for sobre uma encomenda, indique a respetiva referência.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{20,1000}$",
              "errorText": "Escreva entre 20 e 1000 caracteres."
            }
          },
          {
            "id": "consent",
            "title": "Consentimento",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "Aceito ser contactado sobre este pedido, através dos dados que indiquei neste formulário."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "Assinale a caixa para lhe podermos responder."
            }
          }
        ]
      },
      "es": {
        "formTitle": "Contactar con Wi-Mall",
        "formDescription": "Vendiendo, repartiendo, comprando o simplemente con curiosidad — esto llega hasta nosotros. Un formulario para todo: llega al mismo sitio sea cual sea el asunto. Muchas preguntas ya tienen respuesta en las preguntas frecuentes: wi-mall.com/es/faq.",
        "confirmationMessage": "Gracias. Su mensaje ha llegado al equipo de Wi-Mall, y cualquier respuesta se enviará a la dirección de correo que ha indicado.",
        "questions": [
          {
            "id": "full_name",
            "title": "Nombre completo",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "Como máximo 80 caracteres."
            }
          },
          {
            "id": "email",
            "title": "Correo electrónico",
            "helpText": "La dirección a la que debemos responderle.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "Introduzca una dirección de correo válida, por ejemplo nombre@ejemplo.com."
            }
          },
          {
            "id": "whatsapp",
            "title": "Número de WhatsApp o de teléfono",
            "helpText": "Opcional. Empiece por + y el prefijo del país, por ejemplo +237 para Camerún.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "Empiece por + y el prefijo del país, seguido del número: de 8 a 15 dígitos en total, se admiten espacios."
            }
          },
          {
            "id": "role",
            "title": "Soy…",
            "helpText": null,
            "type": "Multiple choice",
            "required": true,
            "options": [
              "Cliente",
              "Vendedor",
              "Agencia de reparto",
              "Repartidor",
              "Socio o prensa",
              "Otro"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "topic",
            "title": "¿De qué se trata?",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Una pregunta general",
              "Mi cuenta o el inicio de sesión",
              "Un pedido o un pago",
              "Vender en Wi-Mall",
              "Repartir con Wi-Mall",
              "Una alianza",
              "Prensa",
              "Otro asunto"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "message",
            "title": "Su mensaje",
            "helpText": "Si se trata de un pedido, indique su referencia.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{20,1000}$",
              "errorText": "Escriba entre 20 y 1000 caracteres."
            }
          },
          {
            "id": "consent",
            "title": "Consentimiento",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "Acepto que se me contacte sobre esta solicitud, con los datos que he indicado en este formulario."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "Marque la casilla para que podamos responderle."
            }
          }
        ]
      },
      "ar": {
        "formTitle": "تواصل مع Wi-Mall",
        "formDescription": "تبيع أو توصّل أو تشتري أو مجرد فضولي — هذه الرسالة تصلنا. استمارة واحدة لكل شيء، تصل إلى المكان نفسه مهما كان موضوعك. ولكثير من الأسئلة إجابة جاهزة في صفحة الأسئلة الشائعة: wi-mall.com/ar/faq",
        "confirmationMessage": "شكراً لك. وصلت رسالتك إلى فريق Wi-Mall، وسيُرسَل أي رد إلى عنوان البريد الإلكتروني الذي أدخلته.",
        "questions": [
          {
            "id": "full_name",
            "title": "الاسم الكامل",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "يجب ألا يزيد الاسم على 80 حرفاً."
            }
          },
          {
            "id": "email",
            "title": "البريد الإلكتروني",
            "helpText": "العنوان الذي نرد عليك عبره.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "أدخل عنوان بريد إلكتروني صالحاً، مثل name@example.com"
            }
          },
          {
            "id": "whatsapp",
            "title": "رقم واتساب أو الهاتف",
            "helpText": "اختياري. ابدأ بعلامة (+) ثم رمز الدولة، مثل 237 للكاميرون. استخدم الأرقام 0-9.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "ابدأ بعلامة (+) ثم رمز الدولة ثم الرقم: من 8 إلى 15 رقماً (0-9) إجمالاً، والمسافات مسموحة."
            }
          },
          {
            "id": "role",
            "title": "أنا…",
            "helpText": null,
            "type": "Multiple choice",
            "required": true,
            "options": [
              "عميل",
              "بائع",
              "وكالة توصيل",
              "موصِّل",
              "شريك أو جهة إعلامية",
              "غير ذلك"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "topic",
            "title": "ما موضوع رسالتك؟",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "سؤال عام",
              "حسابي أو تسجيل الدخول",
              "طلب أو عملية دفع",
              "البيع على Wi-Mall",
              "التوصيل مع Wi-Mall",
              "شراكة",
              "الصحافة والإعلام",
              "موضوع آخر"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "message",
            "title": "رسالتك",
            "helpText": "إن كانت رسالتك بشأن طلب، فاذكر مرجع الطلب.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{20,1000}$",
              "errorText": "اكتب ما بين 20 و1000 حرف."
            }
          },
          {
            "id": "consent",
            "title": "الموافقة",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "أوافق على أن يتواصل معي فريق Wi-Mall بشأن هذه الرسالة، عبر البيانات التي أدخلتها في هذه الاستمارة."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "ضع علامة في المربع لنتمكن من الرد عليك."
            }
          }
        ]
      }
    },
    "careers": {
      "en": {
        "formTitle": "Careers at Wi-Mall",
        "formDescription": "We are not hiring at the moment. Tell us what you do and which of our roles is yours: when one opens, this list is where we start.",
        "confirmationMessage": "Thank you — you are on the list. It is where we start when a role opens.",
        "questions": [
          {
            "id": "full_name",
            "title": "Full name",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "Use 80 characters or fewer."
            }
          },
          {
            "id": "email",
            "title": "Email",
            "helpText": "The address we should use to contact you.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "Enter a valid email address, like you@example.com."
            }
          },
          {
            "id": "whatsapp",
            "title": "WhatsApp or phone number",
            "helpText": "Optional. Start with + and your country code, for example +237 for Cameroon.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "Start with + and the country code, then the number: 8 to 15 digits in all, spaces allowed."
            }
          },
          {
            "id": "location",
            "title": "City and country",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "Use 80 characters or fewer."
            }
          },
          {
            "id": "position",
            "title": "Which role is yours?",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Frontend engineer (Next.js)",
              "Backend engineer (Node, TypeScript)",
              "Engineer, conversational commerce",
              "Mobile engineer (delivery app)",
              "Agency partnerships, Cameroon",
              "Writer, English and French",
              "Open application"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "cv_link",
            "title": "Link to your CV or portfolio",
            "helpText": "Google Drive, Dropbox, GitHub, a personal site… Set the link so that anyone who has it can open it.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "Enter a valid link, for example https://…"
            }
          },
          {
            "id": "linkedin",
            "title": "LinkedIn profile",
            "helpText": "Optional.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "Enter a valid link, for example https://www.linkedin.com/in/…"
            }
          },
          {
            "id": "experience",
            "title": "Years of relevant experience",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Less than 1 year",
              "1–2 years",
              "3–5 years",
              "6–9 years",
              "10 years or more"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "start_date",
            "title": "Earliest start date",
            "helpText": "Optional.",
            "type": "Date",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": null
          },
          {
            "id": "languages",
            "title": "Languages you work in",
            "helpText": "Tick every language you can work in.",
            "type": "Checkboxes",
            "required": true,
            "options": [
              "English",
              "French",
              "Portuguese",
              "Spanish",
              "Arabic"
            ],
            "otherOption": true,
            "validation": null
          },
          {
            "id": "why",
            "title": "Why Wi-Mall?",
            "helpText": "What you do, what you would bring, and what draws you to this work.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{50,1000}$",
              "errorText": "Write between 50 and 1,000 characters."
            }
          },
          {
            "id": "consent",
            "title": "Consent",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "I agree to Wi-Mall keeping this application on file and contacting me about roles that fit it."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "Tick the box so we can keep your application."
            }
          }
        ]
      },
      "fr": {
        "formTitle": "Carrières chez Wi-Mall",
        "formDescription": "Nous ne recrutons pas pour le moment. Dites-nous ce que vous faites et lequel de nos postes est le vôtre : quand l'un s'ouvrira, c'est cette liste que nous consulterons en premier.",
        "confirmationMessage": "Merci, vous êtes sur la liste. C'est par elle que nous commencerons lorsqu'un poste s'ouvrira.",
        "questions": [
          {
            "id": "full_name",
            "title": "Nom complet",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "80 caractères maximum."
            }
          },
          {
            "id": "email",
            "title": "E-mail",
            "helpText": "L'adresse à laquelle vous contacter.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "Saisissez une adresse e-mail valide, par exemple vous@exemple.com."
            }
          },
          {
            "id": "whatsapp",
            "title": "Numéro WhatsApp ou de téléphone",
            "helpText": "Facultatif. Commencez par + et l'indicatif du pays, par exemple +237 pour le Cameroun.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "Commencez par + et l'indicatif du pays, puis le numéro : 8 à 15 chiffres au total, espaces autorisés."
            }
          },
          {
            "id": "location",
            "title": "Ville et pays",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "80 caractères maximum."
            }
          },
          {
            "id": "position",
            "title": "Quel poste est le vôtre ?",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Ingénieur front-end (Next.js)",
              "Ingénieur back-end (Node, TypeScript)",
              "Ingénieur, commerce conversationnel",
              "Ingénieur mobile (application livreur)",
              "Partenariats agences, Cameroun",
              "Rédacteur, français et anglais",
              "Candidature spontanée"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "cv_link",
            "title": "Lien vers votre CV ou portfolio",
            "helpText": "Google Drive, Dropbox, GitHub, un site personnel… Réglez le partage pour que toute personne disposant du lien puisse l'ouvrir.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "Saisissez un lien valide, par exemple https://…"
            }
          },
          {
            "id": "linkedin",
            "title": "Profil LinkedIn",
            "helpText": "Facultatif.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "Saisissez un lien valide, par exemple https://www.linkedin.com/in/…"
            }
          },
          {
            "id": "experience",
            "title": "Années d'expérience pertinente",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Moins d'un an",
              "1 à 2 ans",
              "3 à 5 ans",
              "6 à 9 ans",
              "10 ans ou plus"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "start_date",
            "title": "Date de début au plus tôt",
            "helpText": "Facultatif.",
            "type": "Date",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": null
          },
          {
            "id": "languages",
            "title": "Langues de travail",
            "helpText": "Cochez toutes les langues dans lesquelles vous pouvez travailler.",
            "type": "Checkboxes",
            "required": true,
            "options": [
              "Anglais",
              "Français",
              "Portugais",
              "Espagnol",
              "Arabe"
            ],
            "otherOption": true,
            "validation": null
          },
          {
            "id": "why",
            "title": "Pourquoi Wi-Mall ?",
            "helpText": "Ce que vous faites, ce que vous apporteriez, et ce qui vous attire dans ce travail.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{50,1000}$",
              "errorText": "Écrivez entre 50 et 1 000 caractères."
            }
          },
          {
            "id": "consent",
            "title": "Consentement",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "J'accepte que Wi-Mall conserve cette candidature et me contacte au sujet des postes qui y correspondent."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "Cochez la case pour que nous puissions conserver votre candidature."
            }
          }
        ]
      },
      "pt": {
        "formTitle": "Carreiras na Wi-Mall",
        "formDescription": "Não estamos a recrutar de momento. Diga-nos o que faz e qual das nossas funções é a sua: quando uma abrir, é a esta lista que vamos primeiro.",
        "confirmationMessage": "Obrigado, está na lista. É por ela que começamos quando uma função abrir.",
        "questions": [
          {
            "id": "full_name",
            "title": "Nome completo",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "No máximo 80 caracteres."
            }
          },
          {
            "id": "email",
            "title": "E-mail",
            "helpText": "O endereço para onde o devemos contactar.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "Introduza um endereço de e-mail válido, por exemplo voce@exemplo.com."
            }
          },
          {
            "id": "whatsapp",
            "title": "Número de WhatsApp ou de telefone",
            "helpText": "Opcional. Comece por + e o indicativo do país, por exemplo +237 para os Camarões.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "Comece por + e o indicativo do país, seguido do número: 8 a 15 algarismos no total, pode usar espaços."
            }
          },
          {
            "id": "location",
            "title": "Cidade e país",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "No máximo 80 caracteres."
            }
          },
          {
            "id": "position",
            "title": "Qual destas funções é a sua?",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Engenheiro front-end (Next.js)",
              "Engenheiro back-end (Node, TypeScript)",
              "Engenheiro, comércio conversacional",
              "Engenheiro móvel (aplicação de entregas)",
              "Parcerias com agências, Camarões",
              "Redator, inglês e francês",
              "Candidatura espontânea"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "cv_link",
            "title": "Ligação para o seu CV ou portefólio",
            "helpText": "Google Drive, Dropbox, GitHub, um site pessoal… Defina a partilha para que qualquer pessoa com a ligação a possa abrir.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "Introduza uma ligação válida, por exemplo https://…"
            }
          },
          {
            "id": "linkedin",
            "title": "Perfil do LinkedIn",
            "helpText": "Opcional.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "Introduza uma ligação válida, por exemplo https://www.linkedin.com/in/…"
            }
          },
          {
            "id": "experience",
            "title": "Anos de experiência relevante",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Menos de 1 ano",
              "1 a 2 anos",
              "3 a 5 anos",
              "6 a 9 anos",
              "10 anos ou mais"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "start_date",
            "title": "Data a partir da qual pode começar",
            "helpText": "Opcional.",
            "type": "Date",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": null
          },
          {
            "id": "languages",
            "title": "Línguas em que trabalha",
            "helpText": "Assinale todas as línguas em que pode trabalhar.",
            "type": "Checkboxes",
            "required": true,
            "options": [
              "Inglês",
              "Francês",
              "Português",
              "Espanhol",
              "Árabe"
            ],
            "otherOption": true,
            "validation": null
          },
          {
            "id": "why",
            "title": "Porquê a Wi-Mall?",
            "helpText": "O que faz, o que traria, e o que o atrai neste trabalho.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{50,1000}$",
              "errorText": "Escreva entre 50 e 1000 caracteres."
            }
          },
          {
            "id": "consent",
            "title": "Consentimento",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "Aceito que a Wi-Mall guarde esta candidatura e me contacte sobre funções que lhe correspondam."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "Assinale a caixa para podermos guardar a sua candidatura."
            }
          }
        ]
      },
      "es": {
        "formTitle": "Empleo en Wi-Mall",
        "formDescription": "No estamos contratando en este momento. Cuéntenos qué hace y cuál de nuestros puestos es el suyo: cuando se abra uno, esta es la lista a la que iremos primero.",
        "confirmationMessage": "Gracias, ya está en la lista. Es por donde empezamos cuando se abre un puesto.",
        "questions": [
          {
            "id": "full_name",
            "title": "Nombre completo",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "Como máximo 80 caracteres."
            }
          },
          {
            "id": "email",
            "title": "Correo electrónico",
            "helpText": "La dirección en la que debemos contactarle.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "Introduzca una dirección de correo válida, por ejemplo nombre@ejemplo.com."
            }
          },
          {
            "id": "whatsapp",
            "title": "Número de WhatsApp o de teléfono",
            "helpText": "Opcional. Empiece por + y el prefijo del país, por ejemplo +237 para Camerún.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "Empiece por + y el prefijo del país, seguido del número: de 8 a 15 dígitos en total, se admiten espacios."
            }
          },
          {
            "id": "location",
            "title": "Ciudad y país",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "Como máximo 80 caracteres."
            }
          },
          {
            "id": "position",
            "title": "¿Cuál de estos puestos es el suyo?",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Ingeniero front-end (Next.js)",
              "Ingeniero back-end (Node, TypeScript)",
              "Ingeniero, comercio conversacional",
              "Ingeniero móvil (aplicación de reparto)",
              "Alianzas con agencias, Camerún",
              "Redactor, inglés y francés",
              "Postulación espontánea"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "cv_link",
            "title": "Enlace a su CV o portafolio",
            "helpText": "Google Drive, Dropbox, GitHub, un sitio personal… Configure el enlace para que cualquiera que lo tenga pueda abrirlo.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "Introduzca un enlace válido, por ejemplo https://…"
            }
          },
          {
            "id": "linkedin",
            "title": "Perfil de LinkedIn",
            "helpText": "Opcional.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "Introduzca un enlace válido, por ejemplo https://www.linkedin.com/in/…"
            }
          },
          {
            "id": "experience",
            "title": "Años de experiencia relevante",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "Menos de 1 año",
              "De 1 a 2 años",
              "De 3 a 5 años",
              "De 6 a 9 años",
              "10 años o más"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "start_date",
            "title": "Fecha más temprana de incorporación",
            "helpText": "Opcional.",
            "type": "Date",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": null
          },
          {
            "id": "languages",
            "title": "Idiomas en los que trabaja",
            "helpText": "Marque todos los idiomas en los que puede trabajar.",
            "type": "Checkboxes",
            "required": true,
            "options": [
              "Inglés",
              "Francés",
              "Portugués",
              "Español",
              "Árabe"
            ],
            "otherOption": true,
            "validation": null
          },
          {
            "id": "why",
            "title": "¿Por qué Wi-Mall?",
            "helpText": "Qué hace, qué aportaría y qué le atrae de este trabajo.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{50,1000}$",
              "errorText": "Escriba entre 50 y 1000 caracteres."
            }
          },
          {
            "id": "consent",
            "title": "Consentimiento",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "Acepto que Wi-Mall conserve esta solicitud y me contacte sobre puestos que encajen con ella."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "Marque la casilla para que podamos conservar su solicitud."
            }
          }
        ]
      },
      "ar": {
        "formTitle": "الوظائف في Wi-Mall",
        "formDescription": "نحن لا نوظّف في الوقت الحالي. أخبرنا بما تعمله وأي أدوارنا دورك، وحين يُفتح أحدها فهذه هي القائمة التي نبدأ منها.",
        "confirmationMessage": "شكراً لك، أصبحت على القائمة. ومنها نبدأ حين يُفتح أي دور.",
        "questions": [
          {
            "id": "full_name",
            "title": "الاسم الكامل",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "يجب ألا يزيد الاسم على 80 حرفاً."
            }
          },
          {
            "id": "email",
            "title": "البريد الإلكتروني",
            "helpText": "العنوان الذي نتواصل معك عبره.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → Email",
              "value": null,
              "errorText": "أدخل عنوان بريد إلكتروني صالحاً، مثل name@example.com"
            }
          },
          {
            "id": "whatsapp",
            "title": "رقم واتساب أو الهاتف",
            "helpText": "اختياري. ابدأ بعلامة (+) ثم رمز الدولة، مثل 237 للكاميرون. استخدم الأرقام 0-9.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^\\+ *([0-9] *){8,15}$",
              "errorText": "ابدأ بعلامة (+) ثم رمز الدولة ثم الرقم: من 8 إلى 15 رقماً (0-9) إجمالاً، والمسافات مسموحة."
            }
          },
          {
            "id": "location",
            "title": "المدينة والدولة",
            "helpText": null,
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Length → Maximum character count",
              "value": "80",
              "errorText": "يجب ألا يزيد النص على 80 حرفاً."
            }
          },
          {
            "id": "position",
            "title": "أي هذه الأدوار دورك؟",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "مهندس واجهات أمامية (Next.js)",
              "مهندس خلفية (Node وTypeScript)",
              "مهندس التجارة الحوارية",
              "مهندس تطبيقات جوال (تطبيق التوصيل)",
              "شراكات الوكالات، الكاميرون",
              "كاتب بالإنجليزية والفرنسية",
              "طلب توظيف عفوي"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "cv_link",
            "title": "رابط سيرتك الذاتية أو ملف أعمالك",
            "helpText": "من Google Drive أو Dropbox أو GitHub أو موقع شخصي… واضبط المشاركة بحيث يستطيع أي شخص لديه الرابط فتحه.",
            "type": "Short answer",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "أدخل رابطاً صالحاً يبدأ بـ https://"
            }
          },
          {
            "id": "linkedin",
            "title": "حسابك على LinkedIn",
            "helpText": "اختياري.",
            "type": "Short answer",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Text → URL",
              "value": null,
              "errorText": "أدخل رابطاً صالحاً، مثل https://www.linkedin.com/in/…"
            }
          },
          {
            "id": "experience",
            "title": "سنوات الخبرة ذات الصلة",
            "helpText": null,
            "type": "Dropdown",
            "required": true,
            "options": [
              "أقل من سنة",
              "من سنة إلى سنتين",
              "من 3 إلى 5 سنوات",
              "من 6 إلى 9 سنوات",
              "10 سنوات أو أكثر"
            ],
            "otherOption": false,
            "validation": null
          },
          {
            "id": "start_date",
            "title": "أقرب تاريخ يمكنك البدء فيه",
            "helpText": "اختياري.",
            "type": "Date",
            "required": false,
            "options": null,
            "otherOption": false,
            "validation": null
          },
          {
            "id": "languages",
            "title": "اللغات التي تعمل بها",
            "helpText": "اختر كل لغة تستطيع العمل بها.",
            "type": "Checkboxes",
            "required": true,
            "options": [
              "الإنجليزية",
              "الفرنسية",
              "البرتغالية",
              "الإسبانية",
              "العربية"
            ],
            "otherOption": true,
            "validation": null
          },
          {
            "id": "why",
            "title": "لماذا Wi-Mall؟",
            "helpText": "ما الذي تعمله، وما الذي ستضيفه، وما الذي يجذبك إلى هذا العمل.",
            "type": "Paragraph",
            "required": true,
            "options": null,
            "otherOption": false,
            "validation": {
              "menu": "Regular expression → Matches",
              "value": "^[\\s\\S]{50,1000}$",
              "errorText": "اكتب ما بين 50 و1000 حرف."
            }
          },
          {
            "id": "consent",
            "title": "الموافقة",
            "helpText": null,
            "type": "Checkboxes",
            "required": true,
            "options": [
              "أوافق على أن تحتفظ Wi-Mall بطلبي هذا وأن تتواصل معي بشأن الأدوار التي تناسبه."
            ],
            "otherOption": false,
            "validation": {
              "menu": "Select at least",
              "value": "1",
              "errorText": "ضع علامة في المربع لنتمكن من الاحتفاظ بطلبك."
            }
          }
        ]
      }
    }
  }
};
