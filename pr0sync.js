// ==UserScript==
// @name     pr0game sync
// @version  0.1.5
// @grant    none
// @include  https://pr0game.ddev.site/*
// @include  https://test.pr0game.com/*
// @require  http://127.0.0.1:8090/pocketbase.umd.js
// ==/UserScript==

// Data base connection. You may need to change the URL to a public server for collaborative work.
// When chaning this URL, don't forget to update the @require directive above!
const pb = new PocketBase('http://127.0.0.1:8090/');

async function check_connection() {
    try {
        const records = await pb.collection('users').getFullList({
            sort: '-created',
        });
        console.log("PB Token:", pb.authStore.token);
        return records.length > 0;
    } catch (e) {
        return false;
    }
}

async function login(username, password) {
    pb.authStore.clear();
    try {
        const authData = await pb.collection('users').authWithPassword(username, password);
    } catch (e) {
        return false;
    }
    return await check_connection();
}

/// SVG Daten für die Icons die wir einbauen wollen
const material_share_svg = '<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#5f6368"><path d="M240-40q-33 0-56.5-23.5T160-120v-440q0-33 23.5-56.5T240-640h120v80H240v440h480v-440H600v-80h120q33 0 56.5 23.5T800-560v440q0 33-23.5 56.5T720-40H240Zm200-280v-447l-64 64-56-57 160-160 160 160-56 57-64-64v447h-80Z"/></svg>';
const material_send_svg = '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#5f6368"><path d="M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v140l240 60-240 60v140Zm0 0v-400 400Z"/></svg>';

/// Hilfsfunktionen um aus den SVG Strings Icons zu machen
function make_icon_share(color, width, height) {
    const share_icon = document.createElement("a");
    share_icon.innerHTML = material_share_svg;
    share_icon.querySelector("svg").style.height = height;
    share_icon.querySelector("svg").style.width = width;
    share_icon.querySelector("svg").style.verticalAlign = 'middle';
    share_icon.querySelector("svg").style.fill = color;
    return share_icon;
}

function make_icon_send(color, width, height) {
    const send_icon = document.createElement("a");
    send_icon.innerHTML = material_send_svg;
    send_icon.querySelector("svg").style.height = height;
    send_icon.querySelector("svg").style.width = width;
    send_icon.querySelector("svg").style.verticalAlign = 'middle';
    send_icon.querySelector("svg").style.fill = color;
    return send_icon;
}

function extract_id(popup) {
    // An die Pop-Up Daten zu kommen ist etwas lästig,
    // wir müssen erst den Tooltip extrahieren, daraus ein Element basteln
    // und dann nach dem richtigen Link suchen
    const popup_data = popup.getAttribute('data-tooltip-content');
    var popup_info = document.createElement("div");
    popup_info.innerHTML = popup_data;
    // Spieler-IDs
    const player_link = popup_info.querySelector('a[playerid]');
    if (player_link)
        return player_link.getAttribute('playerid') * 1;
    // Planeten- und Mond-IDs
    const links = popup_info.querySelectorAll('a[href]')
    for (var j = 0; j < links.length; j++) {
        const href = links[j].getAttribute('href');
        if (!href.startsWith('javascript:doit'))
            continue;
        var match = /(\d+)\);$/g.exec(href)
        if (match.length == 2) {
            return match[1] * 1;
        }
    }
    return 0;
}

function extract_own_planet_id(gala, system, planet) {
    var planet_id;
    var moon_id;
    var found_ids = [];
    // Wenn wir unseren eigenen Planeten scannen, gibt es keinen Spio-Link :)
    // Stattdessen können wir hier über die Planetenauswahl gehen
    const my_planets = document.querySelectorAll('#planetSelector option');
    for (var j = 0; j < my_planets.length; j++) {
        var koords = /\[(\d+):(\d+):(\d+)\]$/g.exec(my_planets[j].textContent);

        if (koords.length == 4) {
            if (koords[1] == gala && koords[2] == system && koords[3] == planet) {
                found_ids.push(my_planets[j].getAttribute('value') * 1);
            }
        }
    }
    if (found_ids.length == 1) {
        planet_id = found_ids[0]
    } else {
        // Wenn wir einen Mond haben, dürfte der später entstanden sein als der Planet :)
        if (found_ids[0] < found_ids[1]) {
            planet_id = found_ids[0]
            moon_id = found_ids[1]
        } else {
            planet_id = found_ids[1]
            moon_id = found_ids[0]
        }
    }
    return [planet_id, moon_id]
}

// Parst die Galaxieansicht und sendet Informationen an die Datenbank
async function sync_gala(share_icon) {
    // Gala und System aus den voreingestellten Input-Values übernehmen
    var gala = document.querySelector('input[name=galaxy]').getAttribute("value") * 1;
    var system = document.querySelector('input[name=system]').getAttribute("value") * 1;
    // Darauf vertrauend, dass "table569" uns erhalten bleibt...
    const gala_table = document.querySelector('div.galaxy-grid-container');
    // diejenigen Zeilen selektieren, die Planeteninfos beinhalten
    const planet_rows = gala_table.querySelectorAll('div.galaxy-grid-row');
    console.log("planet_rows " + planet_rows);
    var planets = [];
    for (var i = 0; i < planet_rows.length; i++) {
        const planet = i;
        const planet_row = planet_rows[i];
        // Wenn kein Bild gehen wir von leerer Position aus
        if (planet_row.querySelector('div:nth-child(2) a img') == null) {
            continue;
        } else {
            // Planet ist besiedelt
            const planet_div = planet_row.querySelector('div.galaxy-planet');

            if (!planet_div) {
                alert("Fehlerhafte Tabelle vorgefunden.");
                return;
            }
            // Planetenname nur ohne Aktivitätsinfo übernehmen

            var planet_name = planet_div.querySelector('div:nth-child(2) a').textContent.replace(/\(\*?(\d+ min)?\)$/g, "");
            var planet_picture = planet_div.querySelector('img').getAttribute('src');
            var planet_id = extract_id(planet_div.querySelector('a'), planet_name);
            if (planet_id == 0) {
                planet_id = extract_own_planet_id(gala, system, planet)[0];
            }

            // Mondinformationen sammeln
            var moon_name = "";
            var moon_picture = "";
            var has_moon = false;
            var moon_id = 0;
            const moon_div = planet_row.querySelector('div.galaxy-moon');
            if (moon_div.querySelector('img') != null) {
                has_moon = true;
                moon_picture = moon_div.querySelector('img').getAttribute('src');
                // Der Mondname ist hinter dem Pop-Up versteckt, daher etwas unschön erst mal ein Element konstruieren das wir befragen können
                const moon_data = moon_div.querySelector('a').getAttribute('data-tooltip-content');
                var moon_info = document.createElement("div");
                moon_info.innerHTML = moon_data;
                moon_name = moon_info.querySelector('th').textContent.replace(/^[^\s]* /g, '').replace(/\[\d+:\d+:\d+\]$/g, '');
                moon_id = extract_id(moon_div.querySelector('a'));
                if (moon_id == 0) {
                    moon_id = extract_own_planet_id(gala, system, planet)[1];
                }
            }

            var player_id = extract_id(planet_row.querySelector('div.galaxy-player').querySelector('a'));

            var planet_info = {
                'pos_galaxy': gala,
                'pos_system': system,
                'pos_planet': planet,
                'planet_id': planet_id,
                'planet_picture': planet_picture,
                'planet_name': planet_name.trim(),
                'moon_id': moon_id,
                'moon_picture': moon_picture,
                'moon_name': moon_name.trim(),
                'has_moon': has_moon,
                'player_id': player_id,
                'is_destroyed': false,
            };
            planets.push(planet_info);
        }
    }
    try {
        await pb.send("/galaxy", {
            method: 'POST',
            body: {
                galaxy: gala,
                system: system,
                planets: planets
            },
        });
        // Give feedback that the button was pressed
        share_icon.querySelector('svg').style.fill = "gray";
    } catch (e) {
        alert("Fehler beim Speichern: " + e.message);
    }
}

async function sync_spio(message_group, send_discord, be_silent) {
    if (be_silent === undefined)
        be_silent = false;
    const msg_id = /(\d+)$/g.exec(message_group.querySelector('div.message-item').getAttribute('id'))[1];
    if (msg_id === undefined) {
        if (!be_silent)
            alert("Konnte Spionagebericht nicht extrahieren.");
        else
            console.log("Konnte Spionagebericht nicht extrahieren.");
        return false;
    }

    const body_tr = message_group.querySelector('div.message-item div.message-content div.spyRaport');

    // Scan-Zeitpunkt extrahieren
    const timestamp = message_group.querySelectorAll('div.message-details div.message-date')[0].textContent

    // Herausfinden, welche Daten im Bericht enthalten sind
    const headers = body_tr.querySelectorAll('div.spyRaportContainerHead');
    var has_class0 = false;
    var has_class100 = false;
    var has_class200 = false;
    var has_class400 = false;

    const att_link = body_tr.querySelector('div.spyRaportFooter a:first-child');
    const report_koords = att_link.getAttribute('href').split('&');
    var galaxy = 0;
    var system = 0;
    var planet = 0;
    var planettype = 0;
    for (var i = 0; i < report_koords.length; i++) {
        current = report_koords[i];
        if (current.startsWith('galaxy=')) galaxy = current.split('=')[1] * 1;
        if (current.startsWith('system=')) system = current.split('=')[1] * 1;
        if (current.startsWith('planet=')) planet = current.split('=')[1] * 1;
        if (current.startsWith('planettype=')) planettype = current.split('=')[1] * 1;
    }
    if (galaxy == 0 || system == 0 || planet == 0 || planettype == 0) {
        if (!be_silent)
            alert("Konnte Zielplanet nicht bestimmen.");
        else
            console.log("Konnte Zielplanet nicht bestimmen.");
        return false;
    }

    for (var i = 0; i < headers.length; i++) {
        const current_header = headers[i];
        var current_class = current_header.getAttribute("class").replaceAll("spyRaportContainerHead", "").replace("Class", "");
        if (current_class == "") continue;
        current_class = current_class * 1;
        if (current_class === 0) has_class0 = true;
        if (current_class === 100) has_class100 = true;
        if (current_class === 200) has_class200 = true;
        if (current_class === 400) has_class400 = true;
    }

    var data_maps = {
        'dat0': {},
        'dat100': {},
        'dat200': {},
        'dat400': {},
        'dat900': {},
    };
    const data = body_tr.querySelectorAll('div.spyRaportContainerCell[data-info]');
    for (var i = 0; i < data.length; i++) {
        var info = data[i].getAttribute('data-info');
        var value = data[i].textContent;
        var category = info.split("_")[0]
        var typ = info.split("_")[1]

        data_maps['dat' + category][typ] = value.replaceAll('.', '').replaceAll(',', '').trim() * 1;
    }
    var report = {
        msg_id: msg_id * 1,
        timestamp: timestamp,
        forward: send_discord,
        galaxy: galaxy,
        system: system,
        planet: planet,
        planettype: planettype,
        cat0: has_class0,
        cat100: has_class100,
        cat200: has_class200,
        cat400: has_class400,
        dat: [data_maps['dat0'],
            data_maps['dat100'],
            data_maps['dat200'],
            data_maps['dat400'],
            data_maps['dat900'],
        ],
    }
    try {
        await pb.send("/spio", {
            method: 'POST',
            body: report,
        });

        // Give feedback that the button was pressed
        const icon = message_group.querySelectorAll('a svg');
        for (var i = 0; i < icon.length; i++) {
            icon[i].style.fill = "gray";
        }
    } catch (e) {
        if (!be_silent)
            alert("Fehler beim Speichern: " + e.message);
        else
            console.log("Fehler beim Speichern: " + e.message);
        if (e.status === 422) {
            // This means the spy report was already uploaded, so not an "error" really
            // Give feedback that the button was pressed
            const icon = message_group.querySelectorAll('a svg');
            for (var i = 0; i < icon.length; i++) {
                icon[i].style.fill = "gray";
            }
            return true;
        }
        return false;
    }
    return true;
}

async function sync_stat(share_icon) {
    const header = document.querySelector('table.table519 th').textContent;
    const data_table = document.querySelector('table.table519:has(tr>td+td+td+td+td)');
    const data_rows = data_table.querySelectorAll('tr:has(td)');
    // Versuche die Zeit der Aktualisierung zu extrahieren
    var update_time = /\(.*?(\d+:\d+:\d+)\)$/g.exec(header);
    if (update_time.length < 2) {
        alert("Konnte Updatezeitpunkt nicht bestimmen.");
        return;
    }
    update_time = update_time[1];
    const update_hours = update_time.split(':')[0];
    const update_minutes = update_time.split(':')[1];
    const update_seconds = update_time.split(':')[2];
    // Da das Datumsformat von den Spracheinstellungen abhängt, nehmen wir einfach die Uhrzeit und
    // verlassen uns darauf, dass die Statistik *heute* um diese Uhrzeit aktualisiert wurde
    // Falls das resultierende Datum in der Zukunft liegt (z.B. wenn jemand um 00:01 Uhr klickt)
    // nehmen wir an, dass es sich noch um das Update von gestern handelt :)
    current_date = new Date();
    update_date = new Date();
    update_date.setHours(update_hours);
    update_date.setMinutes(update_minutes);
    update_date.setSeconds(update_seconds);
    update_date.setMilliseconds(0);
    if (current_date - update_date < 0) {
        // Einen Tag abziehen
        update_date = new Date(update_date.setDate(update_date.getDate() - 1));
    }
    const update_epoch = update_date.getTime(); // Should rid us of timezones. Hopefully :)
    const stat_type = document.querySelector('select#type option[selected="selected"]').getAttribute('value').trim() * 1;
    var stat_update = {
        epoch: update_epoch,
        ranking_type: stat_type,
        rankings: [],
    };
    for (var i = 0; i < data_rows.length; i++) {
        const cols = data_rows[i].querySelectorAll('td');

        const rank = cols[0].textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
        const points = cols[4].textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
        const is_umode = cols[1].querySelector('span.galaxy-short-vacation') != null;
        const is_inactive = cols[1].querySelector('span.galaxy-short-inactive') != null;
        const is_long_inactive = cols[1].querySelector('span.galaxy-short-longinactive') != null;
        const is_banned = cols[1].querySelector('span.galaxy-short-banned') != null;
        var player_id = cols[1].querySelector('a').getAttribute('onclick').replace('return Dialog.Playercard(', '');
        const player_name = cols[1].querySelector('a').textContent.trim();
        var alli_id = 0;
        var alli_name = "";
        if (cols[3].querySelector('a') != null) {
            alli_id = cols[3].querySelector('a').getAttribute('href').replace('game.php?page=alliance&mode=info&id=', '') * 1;
            alli_name = cols[3].querySelector('a').textContent.trim();
        }
        player_id = player_id.split(',')[0] * 1;
        stat_update['rankings'].push({
            player_id: player_id,
            player_name: player_name,
            points: points,
            rank: rank,
            alli_id: alli_id,
            alli_name: alli_name,
            is_umode: is_umode,
            is_inactive: is_inactive,
            is_long_inactive: is_long_inactive,
            is_banned: is_banned,
        });
    }
    try {
        await pb.send("/stats", {
            method: 'POST',
            body: stat_update,
        });
        // Give feedback that the button was pressed
        share_icon.querySelector('svg').style.fill = "gray";
    } catch (e) {
        alert("Fehler beim Speichern: " + e.message);
    }
}

async function playercard_sync(iref, share_icon) {
    // Da es hier wenig Anhaltspunkte gibt, gehen wir einfach
    // gottlos über die Zeilennummern
    const rows = iref.querySelectorAll('table tr');
    if (rows.length < 28) {
        alert('Konnte Playercard nicht extrahieren.');
        return;
    }
    var user_id = document.querySelector('iframe').contentDocument.URL.split('=');
    if (user_id.length != 3) {
        alert('Konnte User-ID nicht extrahieren.');
        return;
    }
    user_id = user_id[2] * 1;
    const username = rows[1].querySelector('td:last-child').textContent.trim();
    const home_planet = rows[2].querySelector('td:last-child a').textContent.replace('[', '').replace(']', '').split(':');
    var alli_id = 0;
    var alli_name = "";
    if (rows[3].querySelector('td:last-child a') != null) {
        alli_id = rows[3].querySelector('td:last-child a').getAttribute('onclick');
        alli_id = /&id=(\d+)'/g.exec(alli_id)
        if (alli_id.length < 2) {
            alert('Konnte Allianz nicht extrahieren.');
            return;
        }
        alli_id = alli_id[1] * 1;
        alli_name = rows[3].querySelector('td:last-child a').textContent.trim();
    }
    const buildings_rank = rows[5].querySelector('td:last-child').textContent.trim() * 1;
    const buildings_points = rows[5].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const research_rank = rows[6].querySelector('td:last-child').textContent.trim() * 1;
    const fleet_points = rows[6].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const defense_rank = rows[7].querySelector('td:last-child').textContent.trim() * 1;
    const defense_points = rows[7].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const total_rank = rows[8].querySelector('td:last-child').textContent.trim() * 1;
    const total_points = rows[8].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;


    const won_fights = rows[12].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const drawn_fights = rows[13].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const lost_fights = rows[14].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;

    const honour_points = rows[17].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const honour_rank = rows[18].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;

    const fights_good = rows[21].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const fights_bad = rows[22].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const fights_neutral = rows[23].querySelector('td:nth-child(3)').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;

    const killed_involved = rows[25].querySelector('td:last-child').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const lost_involved = rows[26].querySelector('td:last-child').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const met_involved = rows[27].querySelector('td:last-child').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const kris_involved = rows[28].querySelector('td:last-child').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;

    const killed_real = rows[30].querySelector('td:last-child').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const lost_real = rows[31].querySelector('td:last-child').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const met_real = rows[32].querySelector('td:last-child').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;
    const kris_real = rows[33].querySelector('td:last-child').textContent.replaceAll(',', '').replaceAll('.', '').trim() * 1;

    const player_card = {
        user_id: user_id,
        user_name: username,
        galaxy: home_planet[0] * 1,
        system: home_planet[1] * 1,
        planet: home_planet[2] * 1,
        alli_id: alli_id,
        alli_name: alli_name,
        buildings_rank: buildings_rank,
        buildings_points: buildings_points,
        research_rank: research_rank,
        fleet_points: fleet_points,
        defense_rank: defense_rank,
        defense_points: defense_points,
        total_rank: total_rank,
        total_points: total_points,
        won_fights: won_fights,
        drawn_fights: drawn_fights,
        lost_fights: lost_fights,
        killed_involved: killed_involved,
        lost_involved: lost_involved,
        met_involved: met_involved,
        kris_involved: kris_involved,
        killed_real: killed_real,
        lost_real: lost_real,
        met_real: met_real,
        kris_real: kris_real,
        honour_points: honour_points,
        honour_rank: honour_rank,
        fights_good: fights_good,
        fights_bad: fights_bad,
        fights_neutral: fights_neutral,
    };
    try {
        await pb.send("/player", {
            method: 'POST',
            body: player_card,
        });
        // Give feedback that the button was pressed
        share_icon.style.fill = "gray";
    } catch (e) {
        alert("Fehler beim Speichern: " + e.message);
    }
}

async function sync_empire(empire_sync, share_icon) {
    // First, find our coordinates
    const imageRow = empire_sync.querySelector("tr:has(td a img)")
    const nameRow = imageRow.nextElementSibling;
    const coordRow = nameRow.nextElementSibling;
    // Now, find out how many planets we have
    const planet_coords = coordRow.querySelectorAll("td:has(a)");
    const planet_count = planet_coords.length;
    // Try to match the existing timestamp format
    const timestamp = new Date().toLocaleString("de", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    });
    // Build a fake spy report for each planet
    var reports = []
    for (var i = 0; i < planet_count; i++) {
        const planet_coord = planet_coords[i];
        // First, fill in coordinates
        const coords = /\[(\d+):(\d+):(\d+)\]$/g.exec(planet_coord.textContent);
        if (coords.length != 4) {
            alert("Konnte Koordinaten nicht bestimmen!");
            return;
        }
        const galaxy = coords[1] * 1;
        const system = coords[2] * 1;
        const planet = coords[3] * 1;

        var report = {
            msg_id: -1,
            timestamp: timestamp,
            forward: false,
            galaxy: galaxy,
            system: system,
            planet: planet,
            planettype: 1, // assume planet for now, need to check for moons when we have all info
            cat0: true,
            cat100: true,
            cat200: true,
            cat400: true,
            dat: [
                {}, // dat0
                {}, // dat100
                {}, // dat200
                {}, // dat400
                {}, // dat900
            ]
        }
        reports.push(report);
    }
    // now add the information
    const info_trs = empire_sync.querySelectorAll("tr[data-info]");
    for (var i = 0; i < info_trs.length; i++) {
        const tr = info_trs[i];
        const info_id = parseInt(tr.getAttribute("data-info").split("_")[1]);
        const infos = tr.querySelectorAll("td");
        for (var j = 0; j < planet_count; j++) {
            var info = infos[2 + j].childNodes[0].textContent.trim();
            if (info.length == 0)
                info = infos[2 + j].childNodes[1].textContent.trim();
            if (info == "-")
                continue;
            info = info.replaceAll(',', '').replaceAll('.', '') * 1;
            if (info_id < 100)
                reports[j].dat[0][info_id] = info;
            else if (info_id < 200)
                reports[j].dat[1][info_id] = info;
            else if (info_id < 400)
                reports[j].dat[2][info_id] = info;
            else if (info_id < 900)
                reports[j].dat[3][info_id] = info;
            else
                reports[j].dat[4][info_id] = info;
            // check if the planet has a moon base
            if (info_id == 41 && info > 0)
                reports[j].planettype = 3;
        }
    }
    var count = 0;
    for (var i = 0; i < planet_count; i++) {
        try {
            await pb.send("/spio", {
                method: 'POST',
                body: reports[i],
            });
            count = count + 1;
        } catch (e) {
            alert("Fehler beim Speichern: " + e.message);
            continue;
        }
    }
    alert("" + count + " / " + planet_count + " synchronisiert!");
}

// Findet alle aktuell angezeigten Spionageberichte
// var spy_reports = document.querySelectorAll('tr.message_head:has(+tr.messages_body td div.spyRaport)');
var spy_reports = document.querySelectorAll('div.message-group:has(+div div div.spyRaport)');
// Findet die "Sync" Zeile in der Galaxieansicht
var gala_sync = document.querySelector('td:has(input#gala_sync)');
// Findet Flottenbewegungen in der Phalanx
var stat_sync = document.querySelector('table.table519');
// Findet die Tabelle der Imperiumsansicht
var empire_sync = document.querySelector('table:has(tr.missile[data-info="d_503"])')


// Füge für jeden Spionagebericht einen Senden (Discord) und Speichern (Pocketbase) button ein.
for (var i = 0; i < spy_reports.length; i++) {
    const current_report = spy_reports[i];
    var icon_bar = current_report.querySelector("div.message-item div.message-actions");

    const send_icon = make_icon_send('green', '20px', '20px');
    icon_bar.appendChild(send_icon);

    const share_icon = make_icon_share('green', '18px', '18px');
    icon_bar.appendChild(share_icon);

    send_icon.onclick = function () {
        sync_spio(current_report, true);
    };
    share_icon.onclick = function () {
        sync_spio(current_report, false);
    };
}

if (gala_sync != null) {
    const share_icon = make_icon_share('green', '20px', '20px');
    gala_sync.append(share_icon);
    // sync_gala(share_icon); // illegal to sync automatically
    share_icon.onclick = function () {
        sync_gala(share_icon);
    };
}

if (stat_sync != null) {
    // Wir wollen nur Player-Statistiken. Allianzpunkte sind dann redundant
    if (document.querySelector('select#who option[value="1"][selected="selected"]') != null) {
        const share_icon = make_icon_share('green', '18px', '20px');
        const table_header = document.querySelector('table.table519 tr td');
        table_header.appendChild(share_icon);
        //  sync_stat(share_icon); // illegal to sync automatically
        share_icon.onclick = function () {
            sync_stat(share_icon);
        };
    }
}

if (empire_sync != null) {
    const share_icon = make_icon_share('green', '20px', '20px');
    share_icon.style.float = "right";
    share_icon.onclick = function () {
        sync_empire(empire_sync, share_icon)
    };
    empire_sync.querySelector('th').appendChild(share_icon);
}

// Playercard überschreiben
// Alles etwas umständlich, weil hier ein IFrame dynamisch geladen wird und
// wir in einem anderen Kontext laufen als die Hauptseite.
// Daher
// - erstellen wir ein unsichtbares <div> mit einem .onclick das wieder zu uns
//   zurück führt
// - überschreiben im Hauptfenster die Dialog.Playercard funktion mit unserer eigenen
// - rufen die fancybox selber auf und nutzen das onComplete Callback
// - von wo aus wir das <div> klicken um wieder in den Greasemonkey Kontext zu kommen
// => Wir laufen wieder hier, haben Datenbankzugriff und das IFrame ist entstanden
// - Dann nur noch einmal warten bis der Content vom IFrame auch geladen ist
// => Profit!

const sneak_div = document.createElement('div');
sneak_div.setAttribute('id', 'sneaky_sneak');
document.body.append(sneak_div);
sneak_div.onclick = function () {
    const frame = document.querySelector('iframe');
    if (frame != null) {
        const share_icon = make_icon_share('green', '18px', '20px');
        const iref = frame.contentDocument;
        const header = iref.querySelector('tr th');
        header.appendChild(share_icon);
        share_icon.onclick = function () {
            playercard_sync(iref, share_icon);
        };
        share_icon.style.float = 'right';
    }
};

function on_playercard() {
    // Kopiert aus Original-Code
    Dialog.Playercard = function (id) {
        return $.fancybox({
            width: 650,
            padding: 0,
            height: 600,
            type: 'iframe',
            href: 'game.php?page=playerCard&id=' + id,
            onComplete: function () {
                // Und weil JavaSript aus der Hölle kommt müssen wir hier noch ein weiteres
                // callback einfügen. Sonst ist zwar das iframe da ist aber der Content nicht
                const iframe = document.querySelector('iframe');
                iframe.onload = function () {
                    document.getElementById('sneaky_sneak').click();
                };
            },
        });
    }
}

// Um die originalen Funktionen überschreiben zu können müssen wir uns in den
// Kontext des Hauptfensters einschleichen
addJS_Node(null, null, on_playercard);

// taken from https://stackoverflow.com/a/13485650
function addJS_Node(text, s_URL, funcToRun, runOnLoad) {
    var D = document;
    var scriptNode = D.createElement('script');
    if (runOnLoad) {
        scriptNode.addEventListener("load", runOnLoad, false);
    }
    scriptNode.type = "text/javascript";
    if (text) scriptNode.textContent = text;
    if (s_URL) scriptNode.src = s_URL;
    if (funcToRun) scriptNode.textContent = '(' + funcToRun.toString() + ')()';

    var targ = D.getElementsByTagName('head')[0] || D.body || D.documentElement;
    targ.appendChild(scriptNode);
}

function user_login() {
    const user = document.getElementById('prouser').value;
    const pass = document.getElementById('propass').value;
    login(user, pass).then(function (ret) {
        if (!ret) {
            alert("Login fehlgeschlagen!");
        } else {
            alert("Angemeldet!");
        }
    });
};


// Auf der Settings-Seite einen Login-Button anbieten, um das Token zu regenerieren
if (document.querySelector('form[action="game.php?page=settings"]') != null) {
    const table = document.querySelector('content > table');
    var header = document.createElement('tr');
    header.innerHTML = '<th colspan="2">pr0-sync Login</th>';
    table.appendChild(header);
    var username = document.createElement('tr');
    username.innerHTML = '' +
        '<td width="50%">Username</td>' +
        '<td width="50%" style="height:22px;">' +
        '<input id="prouser" size="20" value="" type="text" maxlength="32">' +
        '</td>';
    table.appendChild(username);
    var password = document.createElement('tr');
    password.innerHTML = '' +
        '<td width="50%">Password</td>' +
        '<td width="50%" style="height:22px;">' +
        '<input id="propass" size="20" value="" type="password" maxlength="32">' +
        '</td>';
    table.appendChild(password);
    var loginbt = document.createElement('tr');
    loginbt.innerHTML = '' +
        '<td width="50%"></td>' +
        '<td width="50%" style="height:22px;">' +
        '<input id="prologin" size="20" value="Login" type="button" maxlength="32">' +
        '</td>';
    table.appendChild(loginbt);

    document.getElementById('prologin').onclick = user_login;
    document.getElementById('propass').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') user_login();
    });
}


// Um die Server Zeit in der Galaxieansicht anzuzeigen müssen wir ebenfalls in den Kontext des Hauptfensters
function addServerTime() {
    const start_time = new Date(startTime).toLocaleString();
    // Get gala view header
    const header = document.querySelector('table.table569 th')
    if (header) {
        const span = document.createElement("span");
        span.style.color = "green";
        span.style.float = "right";
        span.textContent = start_time;
        header.appendChild(span);
    }
}

addJS_Node(null, null, addServerTime);

// Auf der Nachrichtenseite einen Button einfügen, um alle gezeigten Spioberichte hochzuladen
var msgaction = document.querySelectorAll('div.message-action-container');
if (msgaction) {
    var icon = make_icon_share('green', '18px', '20px');
    icon.style.float = "right";
    icon.onclick = sync_spio_all;
    msgaction[0].appendChild(icon);
}

async function sync_spio_all(event) {
    var count = 0;
    for (var i = 0; i < spy_reports.length; i++) {
        const current_report = spy_reports[i];
        if (await sync_spio(current_report, false, true) === true) {
            count = count + 1;
        }
    }
    // Give feedback that the button was pressed
    const icon = event.target.parentElement
    icon.style.fill = "gray";
    alert("" + count + " / " + spy_reports.length + " Berichte abgelegt!");
}

// Im Menü eine Kommandozentrale einfügen, in der Spio- und Angriffslinks abgelegt werden können
const menu = document.querySelector('ul#menu');
const sep = document.querySelectorAll('ul#menu li.menu-separator')[1];
const li = document.createElement('li');
const a = document.createElement('a');
a.href = "#";
a.innerText = "Theke";
li.appendChild(a);
menu.insertBefore(li, sep);

a.onclick = display_theke

async function sendProbes(planetID) {
    const url = "https://" + window.location.hostname + "/game.php?page=fleetAjax&ajax=1&mission=6&planetID=" + planetID;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();
        return json.code == 600;
    } catch (error) {
        console.error(error.message);
    }
    return false;
}

function make_mission_player_content_tr(planet, moon) {
    const tr = document.createElement('tr');
    const td_pos = document.createElement('td');
    const td_name = document.createElement('td');
    const td_spy = document.createElement('td');
    const td_att = document.createElement('td');
    const td_status = document.createElement('td');

    const id = moon ? planet.moon_id : planet.planet_id;
    const planettype = moon ? 3 : 1;
    const pgalaxy = planet.pos_galaxy;
    const psystem = planet.pos_system;
    const pplanet = planet.pos_planet;

    td_pos.innerText = "[" + pgalaxy + ":" + psystem + ":" + pplanet + "]" + (moon ? " (M)" : "");
    td_name.innerText = moon ? planet.moon_name : planet.planet_name;

    const spy_link = document.createElement('a');
    spy_link.href = "#";
    spy_link.innerText = "Spy";
    spy_link.onclick = async () => {
        const result = await sendProbes(id);
        td_status.innerText = result ? "OK" : "Error";
    }
    td_spy.append(spy_link);

    const att_link = document.createElement('a');
    att_link.href = "https://" + window.location.hostname + "/game.php?page=fleetTable&galaxy=" + pgalaxy + "&system=" + psystem + "&planet=" + pplanet + "&planettype=" + planettype + "&target_mission=1";
    att_link.innerText = "Attack";
    td_att.append(att_link);

    tr.append(td_pos, td_name, td_spy, td_att, td_status);
    return tr;
}

function make_mission_player_content(mission_content, planets) {
    mission_content.innerHTML = `<table id="mission-content-player">
    	<tbody>
      	<tr>
    			<th>Position</th>
    			<th>Name</th>
    			<th>Spio</th>
    			<th>Att</th>
    			<th>Status</th>
  			</tr>
       </tbody>
		</table>`;
    const table = document.getElementById('mission-content-player');

    for (var i = 0; i < planets.length; i++) {
        const planet = planets[i];
        const tr = make_mission_player_content_tr(planet, false);
        table.append(tr);
        if (planet.has_moon) {
            const moon_tr = make_mission_player_content_tr(planet, true);
            table.append(moon_tr);
        }
    }
}


var search_str = "";

async function display_mission_player(mission_content, mission_search, search_options) {
    mission_search.hidden = false;
    mission_search.onkeyup = async (e) => {
        if (e.target.value == search_str) return;
        search_str = e.target.value;
        var planets = [];
        try {
            var options = await pb.collection('players').getList(1, 100, {
                filter: pb.filter('player_name = {:search}', {search: search_str})
            });
            if (options.totalItems != 1) {
                options = await pb.collection('players').getList(1, 100, {
                    filter: pb.filter('player_name ~ {:search}', {search: search_str})
                });
            }
            // Update datalist
            var new_options = [];
            for (var i = 0; i < options.items.length; i++) {
                const option = document.createElement('option');
                option.value = options.items[i].player_name;
                new_options.push(option);
            }
            search_options.innerHTML = "";
            search_options.append(...new_options);

            if (options.totalItems == 1) {
                // Found the player, now get the planets
                planets = await pb.collection('galaxy_state').getList(1, 100, {
                    filter: pb.filter('player_id = {:id}', {id: options.items[0].player_id}),
                    sort: "+pos_galaxy, +pos_system, +pos_planet"
                });
                make_mission_player_content(mission_content, planets.items);
                return;
            } else
                make_mission_player_content(mission_content, []);
        } catch (e) {
            alert(e);
        }
    }
    make_mission_player_content(mission_content, []);
}

async function display_mission(mission_content, mission_search, id) {
    mission_search.hidden = true;
    mission_content.innerHTML = `<table id="mission-content-player">
    	<tbody>
      	<tr>
    			<th>Position</th>
    			<th>Name</th>
    			<th>Spio</th>
    			<th>Att</th>
    			<th>Status</th>
  			</tr>
       </tbody>
		</table>`;
    const table = document.getElementById('mission-content-player');
    try {
        // Get the planets for this mission from the database
        const targets = await pb.collection('mission_targets').getList(1, 100, {
            filter: pb.filter('mission = {:id}', {id: id}),
            //sort: "+pos_galaxy, +pos_system, +pos_planet",
            expand: "planet"
        });
        for (var i = 0; i < targets.items.length; i++) {
            table.appendChild(make_mission_player_content_tr(targets.items[i].expand.planet, targets.items[i].moon));
        }

    } catch (error) {
        alert(error);
    }
}

async function display_theke() {
    const content = document.querySelector('content');
    content.innerHTML = `
    <table>
			<tbody>
      	<tr>
					<th>Missionen</th>
				</tr>
				<tr>
					<td>
						<select name="type" id="mission-select" value="1">
							<option value="1">Spieler</option>
						</select>
						<input type="text" list="search-options" name="searchtext" id="mission-search" hidden>
	          <datalist id="search-options">
            </datalist>
					</td>
				</tr>
    	</tbody>
    </table>
    <div id="mission-content"></div>`;
    const mission_select = content.querySelector('#mission-select');
    const mission_content = content.querySelector('#mission-content');
    const mission_search = content.querySelector('#mission-search');
    const search_options = content.querySelector('#search-options');
    mission_select.onchange = (e) => {
        if (e.target.value == 1)
            display_mission_player(mission_content, mission_search, search_options)
        else
            display_mission(mission_content, mission_search, e.target.value);
    }
    const missions = await (pb.collection('mission_list').getList(1, 100));
    for (var i = 0; i < missions.items.length; i++) {
        const mission = missions.items[i];
        const option = document.createElement('option');
        option.value = mission.id;
        option.innerText = mission.name;
        mission_select.appendChild(option);
    }
    display_mission_player(mission_content, mission_search, search_options)
}