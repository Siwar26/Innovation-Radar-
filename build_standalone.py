#!/usr/bin/env python3
"""
Génère le document HTML autonome (Innovation_Radar_Aromatech_Afrique.html)
à partir des fichiers sources du projet Netlify (index.html, style.css,
config.js, app.js). Garde les deux versions synchronisées.

Usage: python3 build_standalone.py <path_to_logo.png> <path_to_seed_data.json> <output.html>
"""
import sys
import re
import json
import base64

def main():
    logo_path, seed_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

    html = open("index.html", encoding="utf-8").read()
    css = open("style.css", encoding="utf-8").read()
    config_js = open("config.js", encoding="utf-8").read()
    app_js = open("app.js", encoding="utf-8").read()
    seed = open(seed_path, encoding="utf-8").read()
    logo_b64 = base64.b64encode(open(logo_path, "rb").read()).decode()

    # --- Patch app.js for standalone (no network calls) ---
    old_loaddata_pattern = re.compile(
        r'  async function loadData\(\) \{.*?\n  \}\n\n  async function syncNow\(\) \{.*?\n  \}',
        re.DOTALL
    )
    new_loaddata = '''  async function loadData() {
    // Version consultation autonome : les données proviennent du jeu de
    // démonstration intégré (window.SEED_DATA), aucune requête réseau.
    // Dans le projet Netlify complet (livré séparément), cette fonction
    // interroge /api/innovations, alimenté par le sync RSS automatique.
    state.items = window.SEED_DATA || [];
    state.meta = {
      lastSync: "2026-09-10T08:00:00.000Z",
      sourceStatuses: (window.APP_CONFIG.SOURCES || []).map(s => ({
        id: s.id, name: s.name,
        status: window.DEMO_SOURCE_STATUS[s.id] || "warning",
        lastSync: window.DEMO_SOURCE_STATUS[s.id] === "active" ? "2026-09-10T08:00:00.000Z" : null
      }))
    };
    render();
  }

  async function syncNow() {
    const btn = $("#syncBtn");
    btn.disabled = true;
    btn.querySelector(".lbl").textContent = t("syncing");
    setTimeout(() => {
      alert(state.lang === "fr"
        ? "Ce document est une version de consultation autonome (données de démonstration figées).\\n\\nLa synchronisation en direct des flux RSS fonctionne dans le projet Netlify complet fourni séparément (dossier innovation-radar/)."
        : "This is a standalone preview document (frozen demo data).\\n\\nLive RSS synchronization runs in the full Netlify project delivered separately (innovation-radar/ folder).");
      btn.disabled = false;
      btn.querySelector(".lbl").textContent = t("syncNow");
    }, 600);
  }'''
    # Utiliser une fonction comme remplacement : re.sub interprète sinon les
    # séquences \n, \g<...> etc. dans une chaîne de remplacement (ce qui
    # casserait les \n voulus comme JS newline-escapes dans new_loaddata).
    app_js_standalone, n = old_loaddata_pattern.subn(lambda m: new_loaddata, app_js)
    assert n == 1, f"loadData/syncNow pattern replaced {n} times, expected 1"

    demo_status = '''window.DEMO_SOURCE_STATUS = {
  foodnavigator:"active", beveragedaily:"active", dairyreporter:"active",
  bakeryandsnacks:"active", confectionerynews:"active", nutraingredients:"active",
  foodbusinessnews:"active", justfood:"active", bevnet:"active",
  fooddive:"active", vegconomist:"active", foodbusinessafrica:"active",
  foodsafetyafrica:"active", fbreporter:"active", howwemadeitinafrica:"active", bevindustry:"active",
  foodingredientsfirst:"error", perfumerflavorist:"error",
  foodbev:"error", ingredientsnetwork:"error",
  innova:"manual", mintel:"manual"
};'''

    # --- Assemble standalone HTML from index.html, inlining everything ---
    out = html

    # Replace <link rel="stylesheet" href="style.css"> with inline <style>
    out = out.replace(
        '<link rel="stylesheet" href="style.css">',
        f'<style>\n{css}\n</style>'
    )
    # Replace favicon/logo file references with embedded base64
    out = out.replace('href="assets/logo/aromatech-logo.png"', f'href="data:image/png;base64,{logo_b64}"')
    out = out.replace('src="assets/logo/aromatech-logo.png"', f'src="data:image/png;base64,{logo_b64}"')
    # Sidebar footer note
    out = out.replace(
        "Innovation Radar v2.0 — + Beverage Trends 2026",
        "Innovation Radar v2.0 — Document de consultation"
    )
    # Sources view note
    out = out.replace(
        '<tbody id="sourcesTbody"></tbody>\n      </table>',
        '<tbody id="sourcesTbody"></tbody>\n      </table>\n'
        '      <p style="font-size:12px;color:var(--gray-500);margin-top:14px">'
        'ℹ️ Statuts illustratifs pour ce document de consultation, basés sur le tableau de faisabilité RSS réel. '
        'Le sync en direct fonctionne dans le projet Netlify complet fourni séparément.</p>'
    )

    # Replace <script src="config.js"></script><script src="app.js"></script>
    # with inline seed data + config + patched app.js
    old_scripts = '<script src="config.js"></script>\n<script src="app.js"></script>'
    new_scripts = (
        f'<script>\n{demo_status}\nwindow.SEED_DATA = {seed};\n</script>\n'
        f'<script>\n{config_js}\n</script>\n'
        f'<script>\n{app_js_standalone}\n</script>'
    )
    assert old_scripts in out, "script tags pattern not found in index.html"
    out = out.replace(old_scripts, new_scripts)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"Written {out_path} ({len(out)} chars)")

if __name__ == "__main__":
    main()
