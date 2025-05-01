routerAdd("POST", "/spio", (c) => {
    if (!c.get("authRecord") && !c.get('admin'))
        return c.json(403, {"message": "Nicht angemeldet"});
    const info = $apis.requestInfo(c);
    const auth_id = info.authRecord.getId();
    // Check permissions
    try {
        const permissions = $app.dao().findFirstRecordByData("permissions", "user", auth_id);
        if (!permissions.get('spio_update'))
            return c.json(403, {"message": "Kein Zugriff!"});
    } catch {
        return c.json(403, {"message": "Kein Zugriff!"});
    }

    const data = new DynamicModel({
        // describe the fields to read (used also as initial values)
        "msg_id": -1,
        "planettype": 0,
        "timestamp": "",
        "galaxy": 0,
        "system": 0,
        "planet": 0,
        "forward": false,
        "cat0": false,
        "cat100": false,
        "cat200": false,
        "cat400": false,
        "dat": [],
    });
    c.bind(data)

    if (data.dat.length !== 5) {
        return c.json(403, {"message": "Fehlerhafter Spionagebericht!"});
    }

    let report = undefined;

    // Check if message was already saved
    if (data.msg_id != -1) {
        try {
            report = $app.dao().findFirstRecordByData("spy_reports", "msg_id", data.msg_id);
            if(!data.forward) { // Already present, abort
                console.log("Bericht schon vorhanden!");
                return c.json(422, {"message": "Bericht bereits abgelegt!"});
            }
        } catch (e) {
            report = undefined;
        }
    }

    console.log("Spy report", data.galaxy, data.system, data.planet, data.timestamp);
    for (const [key, value] of Object.entries(data.dat)) {
        var real_key = 0;
        for (const [key2, value2] of Object.entries(value)) {
            console.log(key2, value2);
        }
    }

    const data_buildings = data.dat[0];
    let data_research = data.dat[1];
    const data_fleet = data.dat[2];
    const data_deff = data.dat[3];
    const data_ress = data.dat[4];
    const is_moon = data.planettype === 3;

    let planet_record = undefined;
    let player_record = undefined;
    // Find associated planet and player
    try {
        planet_record = $app.dao().findFirstRecordByFilter(
            "galaxy_state",
            "pos_galaxy = {:galaxy} && pos_system = {:system} && pos_planet = {:planet} && is_destroyed = false",
            {"galaxy": data.galaxy, "system": data.system, "planet": data.planet}
        );
    } catch (e) {
        console.log(e.message);
        return c.json(403, {"message": "Konnte Planet nicht finden. Bitte Galaxie synchen!!"});
    }
    try {
        player_record = $app.dao().findFirstRecordByFilter(
            "players",
            "player_id = {:player_id}",
            {"player_id": planet_record.get("player_id")}
        );
    } catch (e) {
        console.log(e.message);
        return c.json(403, {"message": "Konnte Spieler nicht finden. Bitte Galaxie synchen!!"});
    }

    if (report == null || report == undefined) { // only save if new record
        // Create record
        // Neuer Planet gefunden, erzeuge Datensatz
        const collection = $app.dao().findCollectionByNameOrId("spy_reports");
        const record = new Record(collection);
        const form = new RecordUpsertForm($app, record)
        form.setDao($app.dao());
        try {
            var rec_data = {
                'pos_galaxy': data.galaxy,
                'pos_system': data.system,
                'pos_planet': data.planet,
                'is_moon': is_moon,
                'created_by': auth_id,
                'msg_id': data.msg_id,
                "player": player_record.get('id'),
                "timestamp": data.timestamp
            };
            if (data.cat0) rec_data["cat0"] = data_buildings;
            if (data.cat0) rec_data["cat100"] = data_research;
            if (data.cat0) rec_data["cat200"] = data_fleet;
            if (data.cat0) rec_data["cat400"] = data_deff;
            if (data.cat0) rec_data["cat900"] = data_ress;
            form.loadData(rec_data);
            form.submit();
        } catch (e) {
            console.log(e);
            return c.json(403, {"message": "Konnte Bericht nicht speichern."});
        }
        const report_id = record.get("id");
        console.log("New record: ", report_id);

        if (data.cat0) { // Update Building state
            if (is_moon)
                planet_record.set("moon_buildings", report_id);
            else
                planet_record.set("planet_buildings", report_id);
        }
        if (data.cat100) { // Update research state
            player_record.set("research", report_id);
        }
        if (data.cat200) { // Update Fleet
            if (is_moon)
                planet_record.set("moon_fleet", report_id);
            else
                planet_record.set("planet_fleet", report_id);
        }
        if (data.cat400) { // Update deff state
            planet_record.set("deff", report_id);
        }
        $app.dao().saveRecord(planet_record);
        $app.dao().saveRecord(player_record);

        report = $app.dao().findFirstRecordByData("spy_reports", "msg_id", data.msg_id);
    }

    // forward to discord
    if (data.forward) {
        const translations = {"901": "Metall", "902": "Kristall", "903": "Deuterium", "911": "Energie", "1": "Metallmine", "2": "Kristallmine", "3": "Deuteriumsynthetisierer", "4": "Solarkraftwerk", "12": "Fusionskraftwerk", "22": "Metallspeicher", "23": "Kristallspeicher", "24": "Deuteriumtank", "14": "Roboterfabrik", "15": "Nanitenfabrik", "21": "Raumschiffwerft", "31": "Forschungslabor", "33": "Terraformer", "34": "Allianzdepot", "41": "Mondbasis", "42": "Sensorphalanx", "43": "Sprungtor", "401": "Raks", "402": "LL", "403": "SL", "404": "Gauss", "405": "Ionen", "406": "Plasma", "407": "k. Schildkuppel", "408": "g. Schildkuppel", "502": "Abfangrak", "503": "Irak", "202": "KT", "203": "GT", "204": "LJ", "205": "SJ", "206": "Kreuzer", "207": "Schlachtschiff", "208": "Koloschiff", "209": "Recycler", "210": "Spios", "211": "Bomber", "212": "Sats", "213": "Zerstörer", "214": "Todesstern", "215": "Schlachtkreuzer", "106": "Spio", "108": "Computertechnik", "109": "Waffentechnik", "110": "Schildtechnik", "111": "Raumschiffpanzerung", "113": "Energietechnik", "114": "Hyperraumtechnik", "115": "Verbrennungstriebwerk", "117": "Impulstriebwerk", "118": "Hyperraumantrieb", "120": "Lasertechnik", "121": "Ionentechnik", "122": "Plasmatechnik", "123": "Intergalaktisches Forschungsnetzwerk", "124": "Astro", "199": "Gravi"};

        const mapped_fleet = Object.entries(data_fleet).filter(([key, value]) => value != null).sort((a,b) => (a[0] < b[0]) ? -1 : 1).map(([key, value]) => ({name: translations[key] || key, value, inline: true}));
        const mapped_def = Object.entries(data_deff).filter(([key, value]) => value != null).sort((a,b) => (a[0] < b[0]) ? -1 : 1).map(([key, value]) => ({name: translations[key] || key, value, inline: true}));
        const mapped_research = []

        if(Object.keys(data_research).length <= 0) { // find latest research of player if data_research is not present
            data_research = undefined;
            try {
                console.log("Try to get research from db");
                const history_report_id = $app.dao().findFirstRecordByData("players", "id", player_record.get("id")).get("research");
                const research_json = $app.dao().findFirstRecordByData("spy_reports", "id", history_report_id).get("cat100");
                data_research = JSON.parse(research_json);
            } catch (e) {
            }
        }

        console.log("data_research: " + data_research);
        const keys_filtered_research_battle = ["109", "110", "111"].filter(key => data_research[key] != null);
        if (keys_filtered_research_battle.length > 0) {
            const merged_battle_research = {
                name: keys_filtered_research_battle.map(key => translations[key].charAt(0)).join('/'),
                value: keys_filtered_research_battle.map(key => data_research[key]).join('/'),
                inline: true
            };
            console.log("merged_battle_research " + Object.entries(merged_battle_research))
            mapped_research.push(merged_battle_research);
        }
        const keys_filtered_engine = ["115", "117", "118"].filter(key => data_research[key] != null);
        if (keys_filtered_engine.length > 0) {
            const merged_engine_research = {
                name: keys_filtered_engine.map(key => translations[key].charAt(0)).join('/'),
                value: keys_filtered_engine.map(key => data_research[key]).join('/'),
                inline: true
            };
            mapped_research.push(merged_engine_research);
        }
        const other_researches = Object.entries(data_research).filter(([key, value]) => value != null)
            .filter(([key, value]) => key == "106" || key == "124" || key == "199") // only specific researches
            .sort((a,b) => (a[0] < b[0]) ? -1 : 1).map(([key, value]) => ({name: translations[key] || key, value, inline: true}));
        if (other_researches != null && other_researches.length > 0) {
            other_researches.forEach(f => mapped_research.push(f));
        }

        const points_fleet_record = new DynamicModel({points_fleet: -1})
        const points_research_record = new DynamicModel({points_research: -1})
        const points_defense_record = new DynamicModel({points_defense: -1})
        $app.dao().db().select("points_fleet").from("uni_rankings").where($dbx.exp("player_id = {:player_id}", {player_id: planet_record.get("player_id")})).andWhere($dbx.exp("points_fleet != -1")).orderBy("date DESC").one(points_fleet_record);
        $app.dao().db().select("points_research").from("uni_rankings").where($dbx.exp("player_id = {:player_id}", {player_id: planet_record.get("player_id")})).andWhere($dbx.exp("points_research != -1")).orderBy("date DESC").one(points_research_record);
        $app.dao().db().select("points_defense").from("uni_rankings").where($dbx.exp("player_id = {:player_id}", {player_id: planet_record.get("player_id")})).andWhere($dbx.exp("points_defense != -1")).orderBy("date DESC").one(points_defense_record);

        let player_alli = "-"
        try {
            player_alli = $app.dao().findFirstRecordByData("alliances", "alli_id", player_record.get("alli_id")).get("alli_name");
        } catch (e) {
        }


        const webhook = $app.dao().findFirstRecordByData("webhooks", "name", "spy-channel")
        const webhookUrl = webhook.get('url');

        const embeds = []

        const reportFields = [
            {
                "name": "Player",
                "value": player_record.get("player_name"),
                "inline": true
            },
            {
                "name": "Allianz",
                "value": player_alli,
                "inline": true
            },
            {
                "name": (is_moon ? "Mond" : "Planet"),
                "value": (is_moon ? planet_record.get("moon_name") : planet_record.get("planet_name")),
                "inline": true
            }
        ]

        if (is_moon && data_buildings["42"] != undefined && data_buildings["42"] != null) {
            reportFields.push({
                "name": ":telescope: Phalanx",
                "value": data_buildings["42"],
            })
        }

        reportFields.push({
                "name": ":rock: Metall",
                "value": data_ress["901"] != undefined && data_ress["901"] != null ? data_ress["901"].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0",
                "inline": true
            },
            {
                "name": ":gem: Kristall",
                "value": data_ress["902"] != undefined && data_ress["902"] != null ? data_ress["902"].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0",
                "inline": true
            },
            {
                "name": ":fuelpump: Deuterium",
                "value": data_ress["903"] != undefined && data_ress["903"] != null ? data_ress["903"].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0",
                "inline": true
            })

        embeds.push({
            "title": ":detective: " + planet_record.get("pos_galaxy") + ":" + planet_record.get("pos_system") + ":" + planet_record.get("pos_planet") + (is_moon ? " M :new_moon:" : " :ringed_planet:"),
            "color": 16777024,
            "fields": reportFields
        })

        if(mapped_fleet != null && mapped_fleet.length > 0) {
            let fleet_icon = " :green_circle:";
            if(points_fleet_record.points_fleet >= 150000) {
                fleet_icon = " :sos:"
            } else if(points_fleet_record.points_fleet >= 100000) {
                fleet_icon = " :warning:"
            } else if(points_fleet_record.points_fleet >= 50000) {
                fleet_icon = " :yellow_circle:"
            }
            embeds.push({
                "title": ":rocket: Flotte (Punkte: " + points_fleet_record.points_fleet.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + fleet_icon + ")",
                "color": 16711680,
                "fields": mapped_fleet
            })
        }
        if(mapped_def != null && mapped_def.length > 0) {
            let def_icon = " :green_circle:";
            if(points_defense_record.points_defense >= 40000) {
                def_icon = " :sos:"
            } else if(points_defense_record.points_defense >= 20000) {
                def_icon = " :warning:"
            } else if(points_defense_record.points_defense >= 10000) {
                def_icon = " :yellow_circle:"
            }
            embeds.push({
                "title": ":microscope: Verteidigung (Punkte: " + points_defense_record.points_defense.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + def_icon + ")",
                "color": 16744192,
                "fields": mapped_def
            })
        }
        if(mapped_research != null && mapped_research.length > 0) {
            embeds.push({
                "title": ":microscope: Forschungen (Punkte: " + points_research_record.points_research.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ")",
                "color": 43775,
                "fields": mapped_research
            })
        }
        try {
            const res = $http.send({
                method: "POST",
                url: webhookUrl,
                body: JSON.stringify({
                    "content": "Spionagebericht von " + report.get("timestamp"),
                    "embeds": embeds
                }),
                headers: {'Content-Type': 'application/json'}
            })
            console.log("Discord forwarding: " + res.statusCode)
            if (res.statusCode >= 300) {
                console.log("Discord response: " + res.json)
            }
        } catch (e) {
            console.log(e);
            return c.json(500, {"message": "Unable to forward to discord."});
        }
    }
    return c.json(200, {"message": "ok"});
});