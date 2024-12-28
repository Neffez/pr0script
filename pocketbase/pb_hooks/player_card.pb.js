routerAdd("POST", "/player", (c) => {
    if(!c.get("authRecord") && !c.get('admin'))
        return c.json(403, { "message": "Nicht angemeldet"});
    const data = new DynamicModel({
        // describe the fields to read (used also as initial values)
        user_id: 0,
        user_name: "",
        galaxy: 0,
        system: 0,
        planet: 0,
        alli_id: 0,
        alli_name: "",
        buildings_rank : 0,
        buildings_points : 0,
        research_rank : 0,
        fleet_points : 0,
        defense_rank : 0,
        defense_points : 0,
        total_rank : 0,
        total_points : 0,
        won_fights : 0,
        drawn_fights : 0,
        lost_fights : 0,
        killed_involved : 0,
        lost_involved : 0,
        met_involved : 0,
        kris_involved : 0,
        killed_real : 0,
        lost_real : 0,
        met_real : 0,
        kris_real : 0,
    });
    c.bind(data);
    console.log("Player Update ", data.user_name + ' (' + data.user_id + ')',
                '[' + data.galaxy + ':' + data.system + ':' + data.planet + ']'
                );
    // Currently, we don't have any use for this data
    return c.json(200, { "message": "ok"});
});