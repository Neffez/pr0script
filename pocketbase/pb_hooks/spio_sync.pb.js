routerAdd("POST", "/spio", (c) => {
    if(!c.get("authRecord") && !c.get('admin'))
        return c.json(403, { "message": "Nicht angemeldet"});
    const info = $apis.requestInfo(c);
    const auth_id = info.authRecord.getId();
    // Check permissions
    try{
        const permissions = $app.dao().findFirstRecordByData("permissions", "user", auth_id);
        if(!permissions.get('spio_update'))
        return c.json(403, { "message": "Kein Zugriff!"});
    } catch {
        return c.json(403, { "message": "Kein Zugriff!"});
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

    if(data.dat.length !== 5)
    {
        return c.json(403, { "message": "Fehlerhafter Spionagebericht!"});
    }

    // Check if message was already saved
    if(data.msg_id != -1)
    {
    try{
        const report = $app.dao().findFirstRecordByData("spy_reports", "msg_id", data.msg_id);
        // Already present, abprt
	    console.log("Bericht schon vorhanden!");
        return c.json(422, { "message": "Bericht bereits abgelegt!"});
    }
    catch (e) 
    {
        ;
    }
    }

    // Log it
    if(true)
    {
        console.log("Spy report", data.galaxy, data.system, data.planet, data.timestamp);
        for (const [key, value] of Object.entries(data.dat)) {
            var real_key = 0;
            for (const [key2, value2] of Object.entries(value)) {
                console.log(key2, value2);
            }
        }
    }

    var data_buildings = data.dat[0];
    var data_research = data.dat[1];
    var data_fleet = data.dat[2];
    var data_deff = data.dat[3];
    var data_ress = data.dat[4];
    var is_moon = data.planettype === 3;

    var planet_record = undefined;
    var player_record = undefined;
    // Find associated planet and player
    try {
    planet_record = $app.dao().findFirstRecordByFilter(
        "galaxy_state", 
        "pos_galaxy = {:galaxy} && pos_system = {:system} && pos_planet = {:planet} && is_destroyed = false",
        {"galaxy": data.galaxy, "system": data.system, "planet": data.planet}
    );} catch(e)
    {
        console.log(e.message);
        return c.json(403, { "message": "Konnte Planet nicht finden. Bitte Galaxie synchen!!"});
    }
    try {
    player_record = $app.dao().findFirstRecordByFilter(
        "players", 
        "player_id = {:player_id}",
        {"player_id": planet_record.get("player_id")}
    );} catch(e)
    {
        console.log(e.message);
        return c.json(403, { "message": "Konnte Spieler nicht finden. Bitte Galaxie synchen!!"});
    }

    // Create record
    // Neuer Planet gefunden, erzeuge Datensatz
    const collection = $app.dao().findCollectionByNameOrId("spy_reports");
    const record = new Record(collection);
    const form = new RecordUpsertForm($app, record)
    form.setDao($app.dao());
    try{
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
        if(data.cat0) rec_data["cat0"] = data_buildings;
        if(data.cat0) rec_data["cat100"] = data_research;
        if(data.cat0) rec_data["cat200"] = data_fleet;
        if(data.cat0) rec_data["cat400"] = data_deff;
        if(data.cat0) rec_data["cat900"] = data_ress;
        form.loadData(rec_data);
        form.submit();
    } catch(e) {
        console.log(e);
        return c.json(403, { "message": "Konnte Bericht nicht speichern."});
    }
    const report_id = record.get("id");
    console.log("New record: ", report_id);

    if(data.cat0) // Update Building state
    {
        if(is_moon)
            planet_record.set("moon_buildings", report_id);
        else
            planet_record.set("planet_buildings", report_id);
    }
    if(data.cat100) // Update research state
    {
        player_record.set("research", report_id);
    }
    if(data.cat200) // Update Fleet
    {
        if(is_moon)
            planet_record.set("moon_fleet", report_id);
        else
            planet_record.set("planet_fleet", report_id);
    }
    if(data.cat400) // Update deff state
    {
        planet_record.set("deff", report_id);
    }
    $app.dao().saveRecord(planet_record);
    $app.dao().saveRecord(player_record);

    return c.json(200, { "message": "ok"});
});