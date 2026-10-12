# Lanekeeper vs staffed mini-sweeper: annual cost per unit and cost per lane-mile swept
KM_PER_MI = 1.609
def today(op_loaded, mi_per_shift, shifts=250, capex=6_700_000/45, life=7, upkeep=15_000):
    annual = capex/life + op_loaded + upkeep
    lane_mi = mi_per_shift * shifts
    return annual, lane_mi, annual/lane_mi
def robot(capex, life, sup_loaded, robots_per_sup, km_per_night, nights=330, cloud=1_500, upkeep=8_000, insurance=3_000):
    annual = capex/life + sup_loaded/robots_per_sup + cloud + upkeep + insurance
    lane_mi = km_per_night / KM_PER_MI * nights
    return annual, lane_mi, annual/lane_mi
S = {
 'low':  dict(t=today(110_000, 20), r=robot( 40_000, 5, 110_000, 15, 12)),
 'base': dict(t=today(130_000, 15), r=robot( 60_000, 5, 130_000, 10, 10)),
 'high': dict(t=today(160_000, 10), r=robot(100_000, 5, 160_000,  5,  7)),
}
for k,v in S.items():
    t,r = v['t'], v['r']
    print(f"{k:5} TODAY annual ${t[0]:,.0f} lane-mi {t[1]:,.0f} per-mi ${t[2]:.2f} | ROBOT annual ${r[0]:,.0f} lane-mi {r[1]:,.0f} per-mi ${r[2]:.2f} | ratio {t[2]/r[2]:.2f}")
print("capex per DSNY unit", 6_700_000/45)
# pilot: 2 robots, 90 days
pilot_hw = 2*60_000; pilot_ops = 130_000*0.25*1 ; cloud=2*1500*0.25; upkeep=2*8000*0.25; ins=2*3000*0.25
print("pilot", pilot_hw, pilot_ops, cloud, upkeep, ins, pilot_hw+pilot_ops+cloud+upkeep+ins)
