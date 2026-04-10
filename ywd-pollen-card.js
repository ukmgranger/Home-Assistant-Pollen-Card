// ==========================================
// 1. THE MAIN BAR CARD
// ==========================================
class YwdPollenBar extends HTMLElement {
  static getConfigElement() {
    return document.createElement("ywd-pollen-bar-editor");
  }

  static getStubConfig() {
    return { 
      type: "custom:ywd-pollen-bar", 
      test_mode: false,
      threshold: 15     
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this.config = config;
  }

  set hass(hass) {
    if (!this.content) {
      this.innerHTML = `
        <div id="pollen-container" style="display: none; flex-direction: column; width: 100%; margin-top: 0px;">
          
          <div style="position: relative; width: 100%; height: 42px; display: flex; align-items: flex-start; padding-top: 8px;">
            
            <div id="pollen-bar-track" style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.15); border-radius: 3px; position: relative; z-index: 2;">
              <div id="pollen-bar-fill" style="height: 100%; width: 0%; border-radius: 3px; transition: width 0.5s ease, background-color 0.5s ease, box-shadow 0.5s ease;"></div>
              <ha-icon id="pollen-bar-marker" style="position: absolute; top: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; transition: left 0.5s ease, color 0.5s ease; z-index: 3;"></ha-icon>
            </div>

            <div id="pollen-particles" style="position: absolute; top: 12px; left: 0; height: 24px; width: 0%; pointer-events: none; z-index: 1; transition: width 0.5s ease; opacity: 0; border-radius: 4px; -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%); mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);"></div>

            <div id="pollen-details" style="position: absolute; top: 24px; right: 0; font-size: 11px; color: var(--secondary-text-color); font-weight: 500; letter-spacing: 0.2px; z-index: 4;"></div>

            <ha-icon id="pollen-label-icon" icon="mdi:flower-pollen" style="position: absolute; top: 20px; left: 0; width: 14px; height: 14px; z-index: 4; opacity: 0.6; color: var(--secondary-text-color);"></ha-icon>

          </div>
          
        </div>
      `;
      this.content = this.querySelector('#pollen-container');
      this.barFill = this.querySelector('#pollen-bar-fill');
      this.marker = this.querySelector('#pollen-bar-marker');
      this.particles = this.querySelector('#pollen-particles');
      this.details = this.querySelector('#pollen-details');
      this.labelIcon = this.querySelector('#pollen-label-icon');
    }

    const threshold = this.config.threshold || 15;

    const t_sensor = this.config.tree_sensor || 'sensor.kleenex_pollen_radar_ripley_trees';
    const g_sensor = this.config.grass_sensor || 'sensor.kleenex_pollen_radar_ripley_grass';
    const w_sensor = this.config.weed_sensor || 'sensor.kleenex_pollen_radar_ripley_weeds';

    const getPpm = (entity) => parseInt(hass.states[entity]?.state) || 0;
    
    const getLvlScore = (entity) => {
      const state = hass.states[`${entity}_level`]?.state?.toLowerCase();
      if (state === 'very high') return 4;
      if (state === 'high') return 3;
      if (state === 'moderate') return 2;
      if (state === 'low') return 1;
      return 0; 
    };
    
    const tree = getPpm(t_sensor);
    const grass = getPpm(g_sensor);
    const weed = getPpm(w_sensor);
    const totalPpm = tree + grass + weed;

    const tLvl = getLvlScore(t_sensor);
    const gLvl = getLvlScore(g_sensor);
    const wLvl = getLvlScore(w_sensor);

    if (totalPpm > threshold || this.config.test_mode) {
      this.content.style.display = 'flex';
      
      let maxLvl = Math.max(tLvl, gLvl, wLvl);
      let sumLvl = tLvl + gLvl + wLvl;
      let extraLvls = sumLvl - maxLvl; 

      let markerIcon = "mdi:flower-pollen"; 
      if (tLvl === maxLvl && tLvl > 0) markerIcon = "mdi:tree";
      if (gLvl === maxLvl && gLvl > 0) markerIcon = "mdi:grass";
      if (wLvl === maxLvl && wLvl > 0) markerIcon = "mdi:sprout"; 

      let percentage = (maxLvl * 25) + (extraLvls * 8);
      
      if (totalPpm <= threshold && this.config.test_mode) {
        percentage = 25; 
      }

      percentage = Math.min(percentage, 100);

      // --- COLOR MATH ---
      const hue = Math.max(0, 120 - (percentage * 1.2));
      const barColor = `hsl(${hue}, 90%, 50%)`;
      const iconColor = `hsl(${hue}, 90%, 35%)`;
      const glowColor = `hsla(${hue}, 90%, 50%, 0.4)`;
      
      // Update Main Bar
      this.barFill.style.backgroundColor = barColor;
      this.barFill.style.boxShadow = `0px 3px 8px 1px ${glowColor}`; 
      this.barFill.style.width = `${percentage}%`;

      // Update Marker
      this.marker.setAttribute('icon', markerIcon);
      this.marker.style.color = iconColor;
      this.marker.style.left = `${percentage}%`;

      // --- POLLEN PARTICLE UNDERGLOW ---
      // Use a proper LCG to generate genuinely irregular particle positions.
      // Seeded by percentage so the pattern is stable across hass updates
      // but shifts naturally between severity levels.
      const dots = [];
      const dotCount = 80;

      // LCG parameters (Numerical Recipes constants)
      let lcg = (percentage + 1) * 1664525 + 1013904223;
      const rand = () => {
        lcg = Math.imul(lcg, 1664525) + 1013904223 | 0;
        return (lcg >>> 0) / 0xFFFFFFFF;
      };

      for (let i = 0; i < dotCount; i++) {
        const x = (rand() * 98).toFixed(1);
        // Bias y toward top (near the bar) — most particles drift downward from it
        const y = (Math.pow(rand(), 0.6) * 90).toFixed(1);
        const size = (0.8 + rand() * 2.2).toFixed(1);       // 0.8px – 3px
        const alpha = (0.4 + rand() * 0.45).toFixed(2);     // 0.40 – 0.85

        dots.push(`radial-gradient(circle ${size}px at ${x}% ${y}%, hsla(${hue}, 90%, 78%, ${alpha}) 0%, transparent 100%)`);
      }

      this.particles.style.backgroundColor = 'transparent';
      this.particles.style.backgroundImage = dots.join(', ');
      this.particles.style.backgroundBlendMode = 'normal';
      this.particles.style.backgroundSize = '100% 100%';
      this.particles.style.width = `${percentage}%`;
      this.particles.style.opacity = '0.85';

      let activePollens = [];
      if (tree > threshold) activePollens.push(`Tree: ${tree}`);
      if (grass > threshold) activePollens.push(`Grass: ${grass}`);
      if (weed > threshold) activePollens.push(`Weed: ${weed}`);

      if (activePollens.length === 0 && this.config.test_mode) {
        this.details.innerHTML = "Test Mode Active (Values below threshold)";
      } else {
        this.details.innerHTML = activePollens.join(' &nbsp;|&nbsp; ');
      }

    } else {
      this.content.style.display = 'none';
      this.particles.style.opacity = '0';
    }
  }

  getCardSize() { return 1; }
}

// ==========================================
// 2. THE GUI EDITOR
// ==========================================
class YwdPollenBarEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.render();
  }

  set hass(hass) { this._hass = hass; }

  render() {
    if (!this._config) return;

    const threshold = this._config.threshold || 15;
    const tree = this._config.tree_sensor || "";
    const grass = this._config.grass_sensor || "";
    const weed = this._config.weed_sensor || "";

    this.innerHTML = `
      <div class="card-config" style="display: flex; flex-direction: column; gap: 16px; padding: 16px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <label style="font-weight: 500; color: var(--primary-text-color);">Enable Test Mode (Force Show)</label>
          <ha-switch id="test_mode" ${this._config.test_mode ? 'checked' : ''}></ha-switch>
        </div>

        <ha-textfield id="threshold" label="Hide text values below this PPM" type="number" value="${threshold}"></ha-textfield>

        <div style="margin-top: 8px;">
          <h3 style="margin: 0; color: var(--primary-text-color); font-size: 14px;">Data Sources (Base Sensors)</h3>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
            <ha-textfield id="tree_sensor" label="Tree Pollen Entity" value="${tree}"></ha-textfield>
            <ha-textfield id="grass_sensor" label="Grass Pollen Entity" value="${grass}"></ha-textfield>
            <ha-textfield id="weed_sensor" label="Weed Pollen Entity" value="${weed}"></ha-textfield>
          </div>
        </div>
      </div>
    `;

    this.querySelector('#test_mode').addEventListener('change', this.updateConfig.bind(this));
    ['#threshold', '#tree_sensor', '#grass_sensor', '#weed_sensor'].forEach(id => {
      this.querySelector(id)?.addEventListener('change', this.updateConfig.bind(this));
    });
  }

  updateConfig(ev) {
    if (!this._config) return;
    const target = ev.target;
    const configKey = target.id;
    let value = target.tagName === 'HA-SWITCH' ? target.checked : target.value;

    if (this._config[configKey] === value) return;
    const newConfig = { ...this._config, [configKey]: value };
    this._config = newConfig;

    const event = new Event("config-changed", { bubbles: true, composed: true });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }
}

// ==========================================
// 3. REGISTRATION
// ==========================================
customElements.define('ywd-pollen-bar', YwdPollenBar);
customElements.define('ywd-pollen-bar-editor', YwdPollenBarEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ywd-pollen-bar",
  name: "YWD Pollen Bar",
  preview: true,
  description: "An amalgamated, smart progress bar with dynamic icon marker and airy fractal dust."
});