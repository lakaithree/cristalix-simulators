(function(self) {
    function npcObjToEntity(npc) {
        var entity = EntityList.newEntityById(1000, minecraft.getWorld());
        if (npc.entityId)
            entity.setEntityId(npc.entityId);
        var profile = new GameProfile(UUID.randomUUID(), npc.name);
        if (npc.skinURL && npc.skinDigest) {
            profile.getProperties().put("skinURL", new Property("skinURL", npc.skinURL, ""));
            profile.getProperties().put("skinDigest", new Property("skinDigest", npc.skinDigest, ""));
        }
        entity.setGameProfile(profile);
        var info = new NetworkPlayerInfo(profile);
        entity.setUniqueId(profile.getId());
        entity.setWearing(EnumPlayerModelParts.CAPE);
        entity.setWearing(EnumPlayerModelParts.JACKET);
        entity.setWearing(EnumPlayerModelParts.LEFT_SLEEVE);
        entity.setWearing(EnumPlayerModelParts.RIGHT_SLEEVE);
        entity.setWearing(EnumPlayerModelParts.LEFT_PANTS_LEG);
        entity.setWearing(EnumPlayerModelParts.RIGHT_PANTS_LEG);
        entity.setWearing(EnumPlayerModelParts.HAT);
        info.setResponseTime(-2);
        if (npc.skinType)
            info.setSkinType(npc.skinType);
        connection.addPlayerInfo(info);
        return entity;
    }

    function die(entity) {
        minecraft.getWorld().removeEntity(entity);
    }

    function square(value) {
        return value * value;
    }

    var PI = 3.14159265358979323846;

    function toDegrees(value) {
        return value * 180.0 / PI;
    }

    function isInsideOfChunk(chunk, x, z) {
        return x >> 4 === chunk.getX() && z >> 4 === chunk.getZ();
    }

    var currentWorld = 'world';
    var npcs = [];
    Events.on(self, "chunk_load", function(chunk) {
        for (let i = 0; i < npcs.length; i++) {
            var npc = npcs[i];
            if (npc.world === currentWorld) {
                if (isInsideOfChunk(chunk, npc.location.x, npc.location.z)) {
                    var npcEntity = npcObjToEntity(npc);
                    minecraft.getWorld().spawnEntity(npcEntity);
                    npcEntity.teleport(npc.location.x, npc.location.y, npc.location.z);
                    npc.entity = npcEntity;
                }
            }
        }
    });
    Events.on(self, "chunk_unload", function(chunk) {
        for (let i = 0; i < npcs.length; i++) {
            var npc = npcs[i];
            if (npc.world === currentWorld) {
                if (isInsideOfChunk(chunk, npc.location.x, npc.location.z)) {
                    npc.entity = undefined;
                }
            }
        }
    });
    var period = 0;
    Events.on(self, "game_loop", function () {
        var now = System.currentTimeMillis();
        var playerX = minecraft.getPlayer().getX();
        var playerY = minecraft.getPlayer().getY();
        var playerZ = minecraft.getPlayer().getZ();
        if (now - period >= 50) {
            period = now;
            for (let i = 0; i < npcs.length; i++) {
                var npc = npcs[i];
                if (npc.headRotation && npc.entity) {
                    var npcLoc = npc.location;
                    var yawDeg = toDegrees(Math.atan2(npcLoc.x - playerX, playerZ - npcLoc.z));
                    var pitchDeg = toDegrees(Math.atan2(npcLoc.y - playerY, Math.sqrt(square(npcLoc.x - playerX) + square(npcLoc.z - playerZ))));
                    npc.entity.setYaw(yawDeg);
                    npc.entity.setRotationYawHead(yawDeg);
                    npc.entity.setPitch(pitchDeg);
                }
            }
        }
    });
    PluginMessages.on(self, "ilyafx_npcs", function(buffer) {
        stdout.println("input")
        var state = UtilNetty.readString(buffer, 128);
        stdout.println(state)
        if ('change_world' === state) {
            currentWorld = UtilNetty.readString(buffer, 128);
            stdout.println(currentWorld);
            for (let i = 0; i < npcs.length; i++) {
                const npc = npcs[i];
                if (npc.entity) {
                    die(npc.entity);
                }
            }
            const minecraftWorld = minecraft.getWorld();
            for (let i = 0; i < npcs.length; i++) {
                const npc = npcs[i];
                if (npc.world === currentWorld) {
                    const chunk = minecraftWorld.getChunkProvider().getLoadedChunk(npc.location.x >> 4, npc.location.z >> 4);
                    if (chunk) {
                        var npcEntity = npcObjToEntity(npc);
                        minecraftWorld.spawnEntity(npcEntity);
                        npcEntity.teleport(npc.location.x, npc.location.y, npc.location.z);
                        npc.entity = npcEntity;
                    }
                }
            }
        } else if ('set_npcs' === state) {
            var count = UtilNetty.readVarInt(buffer);
            stdout.println(count);
            var newNpcs = [];
            for (let i = 0; i < count; i++) {
                var entityId = UtilNetty.readVarInt(buffer);
                var world = UtilNetty.readString(buffer, 128);
                var x = buffer.readDouble();
                var y = buffer.readDouble();
                var z = buffer.readDouble();
                var name = UtilNetty.readString(buffer, 128);
                var hasSkin = buffer.readBoolean();
                var skin = "";
                var digest = "";
                var skinType = "";
                if (hasSkin) {
                    skin = UtilNetty.readString(buffer, 128);
                    digest = UtilNetty.readString(buffer, 128);
                    skinType = UtilNetty.readString(buffer, 128);
                }
                var headRotation = buffer.readBoolean();
                newNpcs.push({
                    entityId: entityId,
                    world: world,
                    location: {
                        x: x,
                        y: y,
                        z: z,
                    },
                    name: name,
                    skinURL: hasSkin ? skin : undefined,
                    skinDigest: hasSkin ? digest : undefined,
                    skinType: hasSkin ? skinType : undefined,
                    headRotation: headRotation,
                });
            }
            for (let i = 0; i < npcs.length; i++) {
                const npc = npcs[i];
                if (npc.entity) {
                    die(npc.entity);
                }
            }
            npcs = newNpcs;
            const minecraftWorld = minecraft.getWorld();
            for (let i = 0; i < npcs.length; i++) {
                const npc = npcs[i];
                if (npc.world === currentWorld) {
                    const chunk = minecraftWorld.getChunkProvider().getLoadedChunk(npc.location.x >> 4, npc.location.z >> 4);
                    if (chunk) {
                        var npcEntity = npcObjToEntity(npc);
                        minecraftWorld.spawnEntity(npcEntity);
                        npcEntity.teleport(npc.location.x, npc.location.y, npc.location.z);
                        npc.entity = npcEntity;
                    }
                }
            }
        }
    });
    PluginMessages.on(self, 'ilyafx_unload', function(e) {
        Events.off(self);
        PluginMessages.off(self);
    });
})(this);