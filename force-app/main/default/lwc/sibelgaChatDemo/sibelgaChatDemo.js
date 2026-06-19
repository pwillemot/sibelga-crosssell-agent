import { LightningElement, track } from 'lwc';
import lisaAvatar from '@salesforce/resourceUrl/sarahAvatar';

// ── Compute interruption date (today + 7) and reminder date (today + 6) ──────
function formatDate(d) {
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
const _int = new Date(); _int.setDate(_int.getDate() + 7);
const _rem = new Date(); _rem.setDate(_rem.getDate() + 6);
const INTERRUPTION_DATE = formatDate(_int);
const REMINDER_DATE     = formatDate(_rem);

// ── Conversation script (mirrors the HTML demo exactly) ───────────────────────
const SCRIPT = [
    {
        text: "Hi! I'm Lisa, your Sibelga virtual assistant. How can I help you today?",
        hint: 'I need to submit my meter reading',
        widget: null,
        autoAdvance: null
    },
    {
        text: "Of course! You can enter your meter number and current reading manually, or just take a photo and I'll read them for you.",
        hint: null,
        widget: 'MeterCapture',
        autoAdvance: null
    },
    {
        text: "Perfect — I've recorded meter {ean} with a reading of {reading} kWh. ✓\nYou'll receive a confirmation email shortly.\n\nBy the way, your consumption this period is below your 3-year average — great news for your bill! 📉",
        hint: null,
        widget: null,
        autoAdvance: 3000
    },
    {
        text: "One more thing I wanted to flag for you — we have a planned maintenance intervention scheduled for {interruptionDate} in your area. The works will affect Rue de la Loi and several surrounding streets in the Saint-Josse/Schaerbeek district. Electricity will be interrupted between 08:00 and 13:00 while our teams carry out necessary upgrades to the local distribution network. We recommend unplugging sensitive devices beforehand.\n\nWould you like us to send you a WhatsApp reminder the evening before, so you're not caught off guard?",
        hint: null,
        widget: 'WhatsAppReminder',
        autoAdvance: null
    },
    {
        text: "Done! ✅ I've set a WhatsApp reminder for you the evening before the interruption. You'll receive it on {reminderDate} at 18:00.",
        hint: 'Thanks!',
        widget: null,
        autoAdvance: null
    },
    {
        text: "While I have you — I can see your meter is single-phase. Many Brussels residents are switching to EV home charging. Would you like to see what Sibelga can help with?",
        hint: 'Yes, tell me more',
        widget: null,
        autoAdvance: null
    },
    {
        text: "Here are our three home charging packages. All include a certified installation by a Sibelga-approved electrician:\n\n⚡ Basic Charge — From €349\nPortable Type 2 cable · No installation needed · Charges at 7kW overnight\n\n⚡ Comfort Charge — From €899\nWallbox Pulsar Plus · Smart home charging at 11kW · Wi-Fi & app control · Installation included\n\n⚡ Smart Charge — From €1,499\nWallbox Pulsar Pro · 22kW (3-phase) · Solar integration · Dynamic load balancing · Full installation\n\nWhich package interests you?",
        hint: 'Tell me more about the Comfort Charge',
        widget: null,
        autoAdvance: null
    },
    {
        text: "Great choice! A certified Sibelga installer will assess your home's connection and handle the full setup. Shall we book a free site visit?",
        hint: 'Yes please',
        widget: null,
        autoAdvance: null
    },
    {
        text: "When would suit you best? Just let me know your preferred date and time (e.g. \"Monday 23 June, 10:00\") and I'll arrange a visit from one of our technicians at your address.",
        hint: 'Monday 23 June at 10:00',
        widget: null,
        autoAdvance: null
    },
    {
        text: "You're all set! 🎉 We'll send a confirmation to your email with all the details. Our technician will be there at the agreed time. See you soon!",
        hint: null,
        widget: null,
        autoAdvance: null
    }
];

export default class SibelgaChatDemo extends LightningElement {
    @track messages    = [];
    @track isOpen      = false;
    @track isConnecting = false;
    @track isTyping    = false;
    @track isComplete  = false;
    @track showLauncherBadge = true;
    @track inputValue  = '';
    @track eanValue    = '';
    @track readingValue = '';

    _scriptIndex = 0;
    _chatOpened  = false;
    _capturedEan = '';
    _capturedReading = '';
    _msgCounter  = 0;

    // ── Computed ─────────────────────────────────────────────────────────────

    get lisaAvatarUrl() { return lisaAvatar; }

    get isLauncherClosed() { return !this.isOpen; }

    get launcherLabel() { return this.isOpen ? 'Close chat' : 'Chat with Lisa'; }

    get agentStatusText() {
        if (this.isConnecting) return 'Sibelga Assistant · Connecting…';
        if (this.isComplete)   return 'Sibelga Assistant · Offline';
        return 'Sibelga Assistant · Online';
    }

    get onlineDotClass() {
        if (this.isConnecting) return 'online-dot connecting';
        if (this.isComplete)   return 'online-dot offline';
        return 'online-dot';
    }

    get inputPlaceholder() {
        if (this.isConnecting) return 'Please wait…';
        if (this.isComplete)   return 'Conversation ended';
        const step = SCRIPT[this._scriptIndex];
        return (step && step.hint) ? step.hint : 'Type your message…';
    }

    get isSendDisabled() {
        return this.isConnecting || this.isTyping || this.isComplete || !this.inputValue.trim() || this._widgetActive;
    }

    get isInputDisabled() {
        return this.isConnecting || this.isComplete || this._widgetActive;
    }

    get isMeterConfirmDisabled() {
        return !(this.eanValue.trim() && this.readingValue.trim());
    }

    get _widgetActive() {
        // input disabled while a widget awaits interaction
        if (!this.messages.length) return false;
        return this.messages.some(m =>
            (m.hasMeterCapture && !m.meterDone) ||
            (m.hasWhatsApp && !m.whatsAppDone)
        );
    }

    // ── Launcher ─────────────────────────────────────────────────────────────

    handleLauncherToggle() {
        this.isOpen = !this.isOpen;
        this.showLauncherBadge = false;
        if (this.isOpen && !this._chatOpened) {
            this._chatOpened = true;
            this._startConnection();
        }
    }

    _startConnection() {
        this.isConnecting = true;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.isConnecting = false;
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => this._showStep(0), 400);
        }, 2000);
    }

    // ── Script rendering ──────────────────────────────────────────────────────

    _showStep(index) {
        const step = SCRIPT[index];
        const text = step.text
            .replace('{ean}',              this._capturedEan     || '33349975')
            .replace('{reading}',          this._capturedReading || '53.095')
            .replace('{interruptionDate}', INTERRUPTION_DATE)
            .replace('{reminderDate}',     REMINDER_DATE);

        this._addMessage(text, 'agent', step.widget);

        if (step.autoAdvance) {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => this._advance(), step.autoAdvance);
        }
    }

    _advance() {
        this._scriptIndex++;
        if (this._scriptIndex >= SCRIPT.length) {
            this.isComplete = true;
            return;
        }
        this.isTyping = true;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this.isTyping = false;
            this._showStep(this._scriptIndex);
        }, 2800 + Math.floor(Math.random() * 1800));
    }

    // ── Input handling ────────────────────────────────────────────────────────

    handleInputChange(event) { this.inputValue = event.target.value; }

    handleKeyDown(event) {
        if (event.key === 'Enter' && !this.isSendDisabled) this.handleSend();
    }

    handleSend() {
        if (this.isSendDisabled) return;
        const text = this.inputValue.trim();
        this.inputValue = '';
        this._addMessage(text, 'prospect', null);
        this._advance();
    }

    // ── EAN / reading inputs ──────────────────────────────────────────────────

    handleEanInput(event)     { this.eanValue     = event.target.value; }
    handleReadingInput(event) { this.readingValue  = event.target.value; }

    handleMeterConfirm() {
        if (this.isMeterConfirmDisabled) return;
        this._capturedEan     = this.eanValue.trim();
        this._capturedReading = Number(this.readingValue).toLocaleString('fr-BE');
        // mark the MeterCapture widget as done
        this.messages = this.messages.map(m =>
            m.hasMeterCapture ? { ...m, meterDone: true } : m
        );
        this._addMessage(
            `Meter ${this._capturedEan}, reading: ${this._capturedReading} kWh`,
            'prospect',
            null
        );
        this._advance();
    }

    // ── WhatsApp reminder ─────────────────────────────────────────────────────

    handleWhatsApp(event) {
        const answer = event.currentTarget.dataset.answer;
        this.messages = this.messages.map(m =>
            m.hasWhatsApp ? { ...m, whatsAppDone: true } : m
        );
        const reply = answer === 'yes' ? 'Yes please, remind me on WhatsApp!' : 'No thanks';
        this._addMessage(reply, 'prospect', null);
        this._advance();
    }

    // ── Message helpers ───────────────────────────────────────────────────────

    _addMessage(text, type, widget) {
        const now  = new Date();
        const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        this.messages = [...this.messages, {
            id:             `${type}-${++this._msgCounter}`,
            text,
            rowClass:       `msg-row ${type}`,
            isAgent:        type === 'agent',
            time,
            hasMeterCapture: widget === 'MeterCapture',
            meterDone:      false,
            hasWhatsApp:    widget === 'WhatsAppReminder',
            whatsAppDone:   false
        }];
        this._scrollToBottom();
    }

    _scrollToBottom() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const el = this.template.querySelector('.chat-messages');
            if (el) el.scrollTop = el.scrollHeight;
        }, 50);
    }
}
