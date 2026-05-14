/**
 * debug.js – Tableau de debug des agents
 */

const DebugView = (() => {
  let _agents = [], _gardes = [];

  // ─── Utilitaires ──────────────────────────────────────────────────────────

  function escHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toYMD(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  function formatDateFR(s) {
    if (!s) return '–';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }

  function calcAge(s) {
    if (!s) return null;
    const today = new Date(), dob = new Date(s);
    if (isNaN(dob) || dob > today) return null;
    return (today - dob) / (1000 * 60 * 60 * 24 * 365.25);
  }

  function calcFacteur(age) {
    if (age === null) return null;
    if (age < 20)  return 0.90;
    if (age < 30)  return 1.00;
    if (age < 40)  return 1.05;
    if (age <= 50) return 1.10;
    if (age <= 60) return 1.15;
    return 1.20;
  }

  function fmtVal(val, type) {
    if (val === null || val === undefined) return '–';
    if (typeof val === 'number' && !isFinite(val)) return '–';
    if (type === 'int')  return String(Math.round(val));
    if (type === 'd2')   return typeof val === 'number' ? val.toFixed(2) : String(val);
    if (type === 'd4')   return typeof val === 'number' ? val.toFixed(4) : String(val);
    if (type === 'pct')  return typeof val === 'number' ? (val * 100).toFixed(2) + ' %' : String(val);
    return String(val);
  }

  // ─── Définitions des colonnes ─────────────────────────────────────────────
  // [lettre, nom, formule/légende, clé, type(text|int|d2|d4|pct), largeur(px)]

  const COLS = [
    ['A',  'Agent',                       'Grade + Nom + Prénom',                                                                                          'A',  'text', 200],
    ['B',  'Date de naissance',            'JJ/MM/AAAA',                                                                                                   'B',  'text',  90],
    ['C',  'Âge',                          'Calculé depuis la date de naissance',                                                                           'C',  'd2',    62],
    ['D',  'Facteur âge',                  '<20→0.90 | 20-29→1.00 | 30-39→1.05 | 40-50→1.10 | 51-60→1.15 | >60→1.20',                                   'D',  'd2',    80],
    ['E',  'Nb gardes',                    '1er janv. → aujourd\'hui (gardes futures exclues)',                                                             'E',  'int',   70],
    ['F',  'Taux de présence',             'E ÷ D',                                                                                                        'F',  'd2',    80],
    ['G',  'CA SUAP',                      'CA sur VSAVM 1 ou VSAV 2',                                                                                     'G',  'int',   65],
    ['H',  'COND SUAP',                    'COND sur VSAVM 1 ou VSAV 2',                                                                                   'H',  'int',   78],
    ['I',  'EQ SUAP',                      'EQ sur VSAVM 1 ou VSAV 2',                                                                                     'I',  'int',   65],
    ['J',  'CA INC',                       'CA sur FPTSR(INC), FPTLOD(INC) ou CMEGP',                                                                      'J',  'int',   60],
    ['K',  'CA1E OD – CBAT2',              'CA/FPTLOD(OD) + CBAT2/FPTSR(INC) + CBAT2/FPTLOD(INC) + CBAT3/FPTSR(INC)',                                    'K',  'int',  108],
    ['L',  'CA1E SR',                      'CA sur FPTSR(SR)',                                                                                              'L',  'int',   68],
    ['M',  'CBAT1',                        'CBAT1/FPTSR(INC) + CBAT1/FPTLOD(INC) + CE/FPTSR(SR)',                                                          'M',  'int',   62],
    ['N',  'EQ INC / OD / BEA / CMEGP',   'EBAT1-3/FPTSR(INC) + EQ/FPTSR(SR) + EBAT1-2/FPTLOD(INC) + EQ/CMEGP + EQ/BEA + EQ/FPTLOD(OD)',               'N',  'int',  135],
    ['O',  'COND EP',                      'COND sur FPTSR(INC), FPTSR(SR), FPTLOD(INC), FPTLOD(OD), CMEGP',                                              'O',  'int',   68],
    ['P',  'STAT',                         'Nb gardes où l\'agent est inscrit STAT',                                                                        'P',  'int',   55],
    ['Q',  'SOG',                          'Nb gardes où l\'agent est inscrit SOG',                                                                         'Q',  'int',   55],
    ['R',  'CA BEA',                       'CA sur BEA',                                                                                                    'R',  'int',   65],
    ['S',  'COND BEA',                     'COND sur BEA',                                                                                                  'S',  'int',   75],
    ['T',  'CA MEA',                       'CA sur MEA',                                                                                                    'T',  'int',   65],
    ['U',  'COND MEA',                     'COND sur MEA',                                                                                                  'U',  'int',   75],
    ['V',  'CA CCF',                       'CA sur CCFM',                                                                                                   'V',  'int',   60],
    ['W',  'COND CCF',                     'COND sur CCFM',                                                                                                 'W',  'int',   72],
    ['X',  'EQ CCF',                       'EQ1 ou EQ2 sur CCFM',                                                                                          'X',  'int',   62],
    ['Y',  'CA ROBOT',                     'CA sur ROBOT',                                                                                                  'Y',  'int',   70],
    ['Z',  'COND ROBOT',                   'COND sur ROBOT',                                                                                                'Z',  'int',   82],
    ['AA', 'SPÉ',                          'Tous postes sur VLHR, VLCG, VTU, VLOG, BLS, AUTRES',                                                           'AA', 'int',   60],
    ['AB', 'NB DÉPART DER. GARDE',         'Total départs de l\'agent lors de sa dernière garde (≤ aujourd\'hui)',                                          'AB', 'int',  130],
    ['AC', '% CA SUAP',                    'G ÷ F',                                                                                                        'AC', 'pct',   80],
    ['AD', '% COND SUAP',                  'H ÷ F',                                                                                                        'AD', 'pct',   90],
    ['AE', '% EQ SUAP',                    'I ÷ F',                                                                                                        'AE', 'pct',   78],
    ['AF', '% CA INC',                     'J ÷ F',                                                                                                        'AF', 'pct',   78],
    ['AG', '% CA1E OD – CBAT2',            'K ÷ F',                                                                                                        'AG', 'pct',  105],
    ['AH', '% CA1E SR',                    'L ÷ F',                                                                                                        'AH', 'pct',   75],
    ['AI', '% CBAT1',                      'M ÷ F',                                                                                                        'AI', 'pct',   68],
    ['AJ', '% EQ INC / OD / BEA / CMEGP', 'N ÷ F',                                                                                                        'AJ', 'pct',  130],
    ['AK', '% COND EP',                    'O ÷ F',                                                                                                        'AK', 'pct',   78],
    ['AL', '% STAT',                       'P ÷ F',                                                                                                        'AL', 'pct',   68],
    ['AM', '% SOG',                        'Q ÷ F',                                                                                                        'AM', 'pct',   65],
    ['AN', '% CA BEA',                     'R ÷ F',                                                                                                        'AN', 'pct',   73],
    ['AO', '% COND BEA',                   'S ÷ F',                                                                                                        'AO', 'pct',   83],
    ['AP', '% CA MEA',                     'T ÷ F',                                                                                                        'AP', 'pct',   73],
    ['AQ', '% COND MEA',                   'U ÷ F',                                                                                                        'AQ', 'pct',   83],
    ['AR', '% CA CCF',                     'V ÷ F',                                                                                                        'AR', 'pct',   73],
    ['AS', '% COND CCF',                   'W ÷ F',                                                                                                        'AS', 'pct',   83],
    ['AT', '% EQ CCF',                     'X ÷ F',                                                                                                        'AT', 'pct',   73],
    ['AU', '% CA ROBOT',                   'Y ÷ F',                                                                                                        'AU', 'pct',   78],
    ['AV', '% COND ROBOT',                 'Z ÷ F',                                                                                                        'AV', 'pct',   88],
    ['AW', '% SPÉ',                        'AA ÷ F',                                                                                                       'AW', 'pct',   68],
    ['AX', 'TOTAL DÉPART',                 'Total départs toutes gardes confondues',                                                                        'AX', 'int',  100],
    ['AY', 'TOTAL PAR GARDE',              'AX ÷ F',                                                                                                       'AY', 'd2',    95],
    ['AZ', 'TOTAL PAR GARDE – SOG DÉDUIT', 'AX ÷ (D – Q)',                                                                                                 'AZ', 'd2',   160],
    ['BA', 'ÉQUILIBRAGE CA SUAP',          '(AB + AC) ÷ 10',                                                                                               'BA', 'd4',   128],
    ['BB', 'ÉQUILIBRAGE COND SUAP',        '(AB + AD) ÷ 10',                                                                                               'BB', 'd4',   138],
    ['BC', 'ÉQUILIBRAGE EQ SUAP',          '(AB + AE) ÷ 10',                                                                                               'BC', 'd4',   122],
  ];

  // ─── Calcul des statistiques d'un agent ───────────────────────────────────

  function computeStats(agent) {
    const today    = new Date();
    const todayStr = toYMD(today);
    const jan1Str  = today.getFullYear() + '-01-01';

    // Gardes de l'agent du 1er janv. à aujourd'hui
    const agentGardes = _gardes.filter(g =>
      g.date >= jan1Str &&
      g.date <= todayStr &&
      (g.agents || []).some(a => a.agentId === agent.id)
    );

    const E = agentGardes.length;
    const age = calcAge(agent.ddn);
    const D   = calcFacteur(age);
    const F   = (D !== null && D > 0) ? E / D : null;

    // STAT / SOG depuis le champ role
    let P = 0, Q = 0;
    for (const g of agentGardes) {
      const entry = (g.agents || []).find(a => a.agentId === agent.id);
      if (!entry) continue;
      const role = entry.role || '';
      if (role === 'STAT') P++;
      if (role === 'SOG')  Q++;
    }

    // Colonnes interventions — toutes à 0 (pas de données interventions.json)
    const G=0, H=0, I=0, J=0, K=0, L=0, M=0, N=0, O=0;
    const R=0, S=0, T=0, U=0, V=0, W=0, X=0, Y=0, Z=0, AA=0;

    // Col. AB – départs dernière garde
    const AB = 0;

    // Col. AX – total départs
    const AX = 0;

    function pct(n) { return (F !== null && F > 0) ? n / F : null; }

    const AC = pct(G),  AD = pct(H),  AE = pct(I);
    const AF = pct(J),  AG = pct(K),  AH = pct(L),  AI = pct(M);
    const AJ = pct(N),  AK = pct(O),  AL = pct(P),  AM = pct(Q);
    const AN = pct(R),  AO = pct(S),  AP = pct(T),  AQ = pct(U);
    const AR = pct(V),  AS = pct(W),  AT = pct(X),  AU = pct(Y);
    const AV = pct(Z),  AW = pct(AA);

    const AY = (F !== null && F > 0) ? AX / F : null;
    const AZ = (D !== null && (D - Q) !== 0) ? AX / (D - Q) : null;

    const BA = (AC !== null) ? (AB + AC) / 10 : null;
    const BB = (AD !== null) ? (AB + AD) / 10 : null;
    const BC = (AE !== null) ? (AB + AE) / 10 : null;

    return {
      A: `${agent.grade} ${agent.nom} ${agent.prenom}`,
      B: formatDateFR(agent.ddn),
      C: age,
      D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V,
      W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK,
      AL, AM, AN, AO, AP, AQ, AR, AS, AT, AU, AV, AW,
      AX, AY, AZ, BA, BB, BC,
    };
  }

  // ─── Rendu HTML ───────────────────────────────────────────────────────────

  async function render(container) {
    container.innerHTML = `<div class="flex items-center justify-center h-32 text-gray-400">Chargement…</div>`;

    const [personnel, rotations] = await Promise.all([
      API.get('personnel.json'),
      API.get('rotations.json'),
    ]);

    _agents = personnel || [];

    // Convertir gardes dict → array [{date, agents:[]}]
    const gardesDict = rotations.gardes || {};
    _gardes = Object.entries(gardesDict).map(([date, agents]) => ({ date, agents }));

    const gradeOrder = [
      'Sapeur 2e classe','Sapeur 1re classe','Caporal','Caporal-chef',
      'Sergent','Sergent-chef','Adjudant','Adjudant-chef',
      'Lieutenant','Capitaine','Commandant','Lieutenant-colonel','Colonel'
    ];

    const sorted = [..._agents]
      .filter(a => a.actif !== false)
      .sort((a, b) => {
        const d = gradeOrder.indexOf(b.grade) - gradeOrder.indexOf(a.grade);
        return d !== 0 ? d : a.nom.localeCompare(b.nom);
      });

    const rows = sorted.map(a => computeStats(a));

    const NR_W   = 44;
    const COL_A  = COLS[0];
    const COL_AW = COL_A[5];
    const ROW_H1 = 28;
    const ROW_H2 = 36;
    const ROW_H3 = 36;
    const scrollCols = COLS.slice(1);

    function buildHeaderRow(rowIdx) {
      const tops    = [0, ROW_H1, ROW_H1 + ROW_H2];
      const bgs     = ['#1e293b', '#334155', '#475569'];
      const colors  = ['#fbbf24', '#f1f5f9', '#cbd5e1'];
      const weights = ['700', '600', '400'];
      const sizes   = ['12px', '11px', '10px'];
      const heights = [ROW_H1, ROW_H2, ROW_H3];

      const top = tops[rowIdx], bg = bgs[rowIdx], color = colors[rowIdx];
      const fw = weights[rowIdx], fs = sizes[rowIdx], h = heights[rowIdx];

      function getCell(col) {
        const w = col[5];
        if (rowIdx === 0) return `<span style="color:${color};font-weight:${fw};font-size:${fs};">${escHtml(col[0])}</span>`;
        const txt = rowIdx === 1 ? col[1] : col[2];
        return `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:${w - 8}px;color:${color};font-weight:${fw};font-size:${fs};" title="${escHtml(txt)}">${escHtml(txt)}</div>`;
      }

      return `<tr style="height:${h}px;">
        <th style="position:sticky;top:${top}px;left:0;z-index:40;background:${bg};min-width:${NR_W}px;max-width:${NR_W}px;border:1px solid #64748b;padding:2px 4px;text-align:center;">
          ${rowIdx === 0 ? `<span style="color:#94a3b8;font-weight:600;font-size:11px;">N°</span>` : ''}
        </th>
        <th style="position:sticky;top:${top}px;left:${NR_W}px;z-index:39;background:${bg};min-width:${COL_AW}px;max-width:${COL_AW}px;border:1px solid #64748b;padding:2px 6px;text-align:center;">
          ${getCell(COL_A)}
        </th>
        ${scrollCols.map(col => {
          const w = col[5];
          return `<th style="position:sticky;top:${top}px;z-index:20;background:${bg};min-width:${w}px;max-width:${w}px;border:1px solid #64748b;padding:2px 4px;text-align:center;">${getCell(col)}</th>`;
        }).join('')}
      </tr>`;
    }

    function buildDataRows() {
      return rows.map((r, idx) => {
        const isEven = idx % 2 === 0;
        const bg = isEven ? '#ffffff' : '#f8fafc';
        const bgHL = '#fef9c3';

        const cells = scrollCols.map(col => {
          const val = fmtVal(r[col[3]], col[4]);
          const isNum = col[4] !== 'text';
          return `<td style="min-width:${col[5]}px;max-width:${col[5]}px;border:1px solid #e2e8f0;padding:2px 5px;font-size:11px;text-align:${isNum ? 'right' : 'left'};white-space:nowrap;" title="${escHtml(val)}">${escHtml(val)}</td>`;
        }).join('');

        const agentLabel = fmtVal(r['A'], 'text');

        return `<tr data-row-idx="${idx}" data-row-bg="${bg}" style="background:${bg};cursor:pointer;"
            onclick="(function(tr){
              const wasHL = tr.dataset.highlighted === '1';
              document.querySelectorAll('#debug-table tr[data-row-idx]').forEach(r => {
                r.dataset.highlighted = '0';
                r.style.background = r.dataset.rowBg;
                r.querySelectorAll('td[data-sticky]').forEach(td => td.style.background = r.dataset.rowBg);
              });
              if (!wasHL) {
                tr.dataset.highlighted = '1';
                tr.style.background = '${bgHL}';
                tr.querySelectorAll('td[data-sticky]').forEach(td => td.style.background = '${bgHL}');
              }
            })(this)"
            onmouseenter="if(this.dataset.highlighted!=='1'){this.style.background='#eff6ff';this.querySelectorAll('td[data-sticky]').forEach(td=>td.style.background='#eff6ff');}"
            onmouseleave="if(this.dataset.highlighted!=='1'){const b=this.dataset.rowBg;this.style.background=b;this.querySelectorAll('td[data-sticky]').forEach(td=>td.style.background=b);}">
          <td data-sticky style="position:sticky;left:0;z-index:10;background:${bg};min-width:${NR_W}px;max-width:${NR_W}px;border:1px solid #e2e8f0;padding:2px 4px;text-align:center;color:#94a3b8;font-size:11px;font-weight:500;">${idx + 1}</td>
          <td data-sticky style="position:sticky;left:${NR_W}px;z-index:10;background:${bg};min-width:${COL_AW}px;max-width:${COL_AW}px;border:1px solid #e2e8f0;padding:2px 6px;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(agentLabel)}">${escHtml(agentLabel)}</td>
          ${cells}
        </tr>`;
      }).join('');
    }

    container.innerHTML = `
      <div style="height:calc(100vh - 48px);overflow:auto;background:#f1f5f9;-webkit-overflow-scrolling:touch;">
        <table id="debug-table" style="border-collapse:separate;border-spacing:0;min-width:max-content;font-family:'Inter',system-ui,sans-serif;">
          <thead>
            ${buildHeaderRow(0)}
            ${buildHeaderRow(1)}
            ${buildHeaderRow(2)}
          </thead>
          <tbody>
            ${buildDataRows()}
          </tbody>
        </table>
      </div>
    `;
  }

  return { render };
})();
