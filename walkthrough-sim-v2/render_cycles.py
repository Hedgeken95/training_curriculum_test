# Build the 201 walkthrough scene in Blender from the exported GLB + camera track and render frames with Cycles.
# usage: python3 render_cycles.py --dir <folder with scene.glb, camera.json, tex/> --shot walk|over
#        --start N --end M --out <frame dir> [--spp 48] [--scale 1.0] [--threads 0]
import argparse, json, math, os, sys
import bpy
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument('--dir', required=True); ap.add_argument('--shot', required=True)
ap.add_argument('--start', type=int, required=True); ap.add_argument('--end', type=int, required=True)
ap.add_argument('--out', required=True); ap.add_argument('--spp', type=int, default=48)
ap.add_argument('--scale', type=float, default=1.0); ap.add_argument('--threads', type=int, default=0)
ap.add_argument('--exposure', type=float, default=0.0)
ap.add_argument('--frames', default='')  # comma list of 0-based indices for test stills
A = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

D = A.dir
cam_data = json.load(open(os.path.join(D, 'camera.json')))
track = cam_data['track'][A.shot]
LIGHTS = cam_data['lights']
FPS = cam_data['durations']['fps']
over = A.shot == 'over'

def b(v):  # three.js world (Y up, +Z south) -> Blender (Z up)
    return Vector((v[0], -v[2], v[1]))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=os.path.join(D, 'scene.glb'))

# ---------- visibility per shot ----------
def descendants(name):
    root = bpy.data.objects.get(name)
    return [] if root is None else [root] + list(root.children_recursive)
for o in descendants('G_ceiling') + descendants('G_outdoor'):
    o.hide_render = over
for o in descendants('G_over'):
    o.hide_render = not over

# ---------- materials ----------
def base(name):
    return name.split('.')[0]
def load_img(fn, colour=False):
    img = bpy.data.images.load(os.path.join(D, 'tex', fn), check_existing=True)
    if not colour: img.colorspace_settings.name = 'Non-Color'
    return img
def add_bump(m, img_name, strength, scale=1.0, invert=False):
    nt = m.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    if bsdf is None: return
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale, scale, scale)
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = load_img(img_name)
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.invert = invert
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], ti.inputs['Vector'])
    nt.links.new(ti.outputs['Color'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], bsdf.inputs['Normal'])
def set_principled(m, **kw):
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    for k, v in kw.items():
        if k in bsdf.inputs: bsdf.inputs[k].default_value = v
    return bsdf
def glass(m, rough=0.0, transmission=1.0, tint=(0.97, 0.99, 1.0, 1)):
    nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = tint; p.inputs['Roughness'].default_value = rough
    p.inputs['Transmission Weight'].default_value = transmission; p.inputs['IOR'].default_value = 1.45
    if 'Thin Film Thickness' in p.inputs: pass
    nt.links.new(p.outputs['BSDF'], out.inputs['Surface'])
    m.blend_method = 'HASHED' if hasattr(m, 'blend_method') else None

for m in bpy.data.materials:
    if not m.use_nodes: continue
    n = base(m.name)
    if n == 'floor': add_bump(m, 'floor_bump.png', 0.25); set_principled(m, Roughness=0.38)
    elif n in ('wallUp', 'wallLow', 'ceiling'): add_bump(m, 'wall_bump.png', 0.06, 1.0)
    elif n in ('wood', 'woodKitchen', 'walnut'): set_principled(m, Roughness=0.42)
    elif n == 'glass': glass(m, 0.0)
    elif n == 'frosted': glass(m, 0.45, 1.0, (0.95, 0.97, 0.98, 1))
    elif n == 'railPanel': glass(m, 0.6, 0.85, (0.95, 0.96, 0.96, 1))
    elif n == 'emissive':
        bsdf = set_principled(m, **{'Emission Color': (1.0, 0.86, 0.68, 1), 'Emission Strength': 0.0 if over else 30.0})
    elif n == 'stone': set_principled(m, Roughness=0.4, **{'Specular IOR Level': 0.4})
    elif n == 'studio' and over: set_principled(m, **{'Base Color': (0.86, 0.85, 0.83, 1)})

# glass and translucent panels let light through without casting hard shadows
for o in bpy.data.objects:
    if o.type == 'MESH' and o.active_material and base(o.active_material.name) in ('glass', 'frosted', 'railPanel'):
        o.visible_shadow = False

# ---------- lights ----------
CH = LIGHTS['ch']
def add_light(name, kind, loc, energy, color, **kw):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    for k, v in kw.items(): setattr(ld, k, v)
    o = bpy.data.objects.new(name, ld); sc.collection.objects.link(o); o.location = loc
    return o, ld

sun_dir = b(LIGHTS['sun']).normalized()
if over:
    sun_dir = Vector((0.35, -0.45, 0.82)).normalized()
sun, sd = add_light('sun', 'SUN', (0, 0, 10), 2.6 if over else 5.5, (1.0, 0.95, 0.88), angle=math.radians(1.2))
sun.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()

world = bpy.data.worlds.new('world'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
if over:
    bg.inputs['Color'].default_value = (0.88, 0.87, 0.85, 1); bg.inputs['Strength'].default_value = 1.0
else:
    # simple daylight dome: brighter, bluer above the horizon
    nt = world.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[0].color = (0.82, 0.86, 0.90, 1)
    ramp.color_ramp.elements[1].position = 0.6; ramp.color_ramp.elements[1].color = (0.45, 0.62, 0.88, 1)
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    mapr = nt.nodes.new('ShaderNodeMapRange'); mapr.inputs['From Min'].default_value = 0.5; mapr.inputs['From Max'].default_value = 1.0
    nt.links.new(sep.outputs['Z'], mapr.inputs['Value']); nt.links.new(mapr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 2.2

if not over:
    # light portals in the window openings guide sky sampling (less noise indoors)
    for (loc, size, rot) in [((11.05, -1.40, 1.03), (1.70, 2.05), (0, math.radians(-90), 0)),
                             ((3.12, 0.10, 1.55), (1.0, 1.0), (math.radians(-90), 0, 0)),
                             ((8.55, 0.10, 1.83), (0.5, 0.65), (math.radians(-90), 0, 0))]:
        o, ld = add_light('portal', 'AREA', loc, 0, (1, 1, 1), shape='RECTANGLE', size=size[0], size_y=size[1])
        ld.cycles.is_portal = True; o.rotation_euler = rot
    warm = (1.0, 0.84, 0.66)
    for i, (x, z, on) in enumerate(LIGHTS['downlights']):
        if not on: continue
        o, ld = add_light(f'dl{i}', 'SPOT', b([x, CH - 0.02, z]), 45.0, warm,
                          spot_size=math.radians(115), spot_blend=0.65, shadow_soft_size=0.04)
        o.rotation_euler = (0, 0, 0)  # spot points down -Z

# ---------- camera + door animation ----------
camd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', camd); sc.collection.objects.link(cam); sc.camera = cam
camd.sensor_fit = 'VERTICAL'; camd.clip_start = 0.03; camd.clip_end = 500
door = bpy.data.objects.get('door_bedB')
for i, f in enumerate(track):
    fr = i + 1
    cam.location = b(f['p']); cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = b(f['d']).normalized().to_track_quat('-Z', 'Y')
    camd.angle_y = math.radians(f['fov'])
    cam.keyframe_insert('location', frame=fr); cam.keyframe_insert('rotation_quaternion', frame=fr)
    camd.keyframe_insert('lens', frame=fr)
    if door is not None:
        door.location.y = -f['door']; door.keyframe_insert('location', frame=fr)

# ---------- render settings ----------
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'; cy.samples = A.spp; cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.015
cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'; cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
cy.denoising_prefilter = 'ACCURATE'
cy.seed = 7; cy.use_animated_seed = False
cy.max_bounces = 8; cy.diffuse_bounces = 4; cy.glossy_bounces = 3; cy.transmission_bounces = 8; cy.transparent_max_bounces = 8
cy.sample_clamp_indirect = 6.0; cy.blur_glossy = 1.0; cy.caustics_reflective = False; cy.caustics_refractive = False
if A.threads: sc.render.threads_mode = 'FIXED'; sc.render.threads = A.threads
sc.render.use_persistent_data = True
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.3
sc.render.resolution_x = int(1920 * A.scale); sc.render.resolution_y = int(1080 * A.scale); sc.render.resolution_percentage = 100
sc.render.fps = FPS
sc.view_settings.view_transform = 'AgX'
sc.view_settings.exposure = A.exposure + (0.3 if over else 1.6)
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '8'
os.makedirs(A.out, exist_ok=True)
sc.render.filepath = os.path.join(os.path.abspath(A.out), '#####')
# frames are 0-based in the track; Blender frame = index + 1, output named by index
sc.frame_start = A.start + 1; sc.frame_end = A.end
sc.render.use_overwrite = False; sc.render.use_placeholder = True
sc.render.filepath = os.path.join(os.path.abspath(A.out), 'f_#####')
if A.frames:
    import time
    for idx in [int(x) for x in A.frames.split(',')]:
        sc.frame_set(idx + 1); sc.render.filepath = os.path.join(os.path.abspath(A.out), f'{A.shot}_{idx:05d}.png')
        t0 = time.time(); bpy.ops.render.render(write_still=True); print('FRAME', idx, round(time.time() - t0, 1), flush=True)
else:
    bpy.ops.render.render(animation=True)
print('DONE', A.shot, A.start, A.end)
