/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/galaxy", (c) => {
    if(!c.get("authRecord") && !c.get('admin'))
        return c.json(403, { "message": "Nicht angemeldet"});
    const info = $apis.requestInfo(c);
    const auth_id = info.authRecord.getId();
    // Check permissions
    try{
        const permissions = $app.dao().findFirstRecordByData("permissions", "user", auth_id);
        if(!permissions.get('gala_update'))
        return c.json(403, { "message": "Kein Zugriff!"});
    } catch {
        return c.json(403, { "message": "Kein Zugriff!"});
    }

    const data = new DynamicModel({
        // describe the fields to read (used also as initial values)
        galaxy: 0,
        system: 0,
        planets:  [],
    })
    c.bind(data)
    console.log("Updating", data.galaxy, data.system)
    
    $app.dao().runInTransaction( (txDao) => {
        const records = txDao.findRecordsByFilter("galaxy_state",
        "is_destroyed = false && pos_galaxy = " + data.galaxy + " && pos_system = " + data.system);

        var known_planets = {};

        // Temporarily mark all planets as destroyed
        for(var i = 0; i < records.length; i++)
        {
            known_planets[records[i].get('pos_planet')] = records[i];
            records[i].set("is_destroyed", true);
        }
        // Compare with new data
        for(var i = 0; i < data.planets.length; i++)
        {
            const current_planet = data.planets[i];
            const current_pos = current_planet['pos_planet'];
            if(current_pos in known_planets)
            {
                // Already present in the database
                if(known_planets[current_pos].get('planet_id') == current_planet['planet_id'])
                {
                    // Same planet as before
                    known_planets[current_pos].set('planet_name', current_planet['planet_name']);
                    known_planets[current_pos].set('has_moon', current_planet['has_moon']);
                    known_planets[current_pos].set('moon_picture', current_planet['moon_picture']);
                    known_planets[current_pos].set('moon_name', current_planet['moon_name']);
                    known_planets[current_pos].set('is_destroyed', false);
                    continue; // next planet, please
                }
            }
            
            // Found a new planet, create the Record
            const collection = $app.dao().findCollectionByNameOrId("galaxy_state");
            const record = new Record(collection);
            const form = new RecordUpsertForm($app, record)
            form.setDao(txDao);
            try{
                form.loadData({
                    'pos_galaxy': data.galaxy,
                    'pos_system': data.system,
                    'pos_planet': current_planet['pos_planet'],
                    'planet_id': current_planet['planet_id'],
                    'planet_picture': current_planet['planet_picture'],
                    "planet_name": current_planet['planet_name'],
                    "moon_id": current_planet['moon_id'],
                    "moon_picture": current_planet['moon_picture'],
                    "moon_name": current_planet['moon_name'],
                    "has_moon": current_planet['has_moon'],
                    "tf_met": 0,
                    "tf_kris": 0,
                    "player_id": current_planet['player_id'],
                    "is_destroyed": false,
                    'created_by': auth_id
                });
            } catch(e) {
                console.log(e);
                return c.json(200, { "message": "internal server error"});
            }
            form.submit();
        }
        // Any finally, save the actually destroyed planets
        for(var i = 0; i < records.length; i++)
        {
            try{
                txDao.saveRecord(records[i]);
            } catch (e) {
                console.log(e);
                return c.json(200, { "message": "internal server error"});
            }
        }
    });

    return c.json(200, { "message": "ok"});
});