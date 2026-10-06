ALTER TABLE "AttributeGroup" ADD COLUMN "icon" TEXT;
ALTER TABLE "Attribute" ADD COLUMN "icon" TEXT;
CREATE TABLE "CustomIcon" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "svg" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomIcon_pkey" PRIMARY KEY ("id")
);
-- Sensible defaults for the seeded spec groups/attributes.
UPDATE "AttributeGroup" SET "icon" = CASE "key"
  WHEN 'display' THEN 'lucide:Smartphone' WHEN 'performance' THEN 'lucide:Cpu' WHEN 'camera' THEN 'lucide:Camera'
  WHEN 'battery' THEN 'lucide:BatteryFull' WHEN 'connectivity' THEN 'lucide:Wifi' WHEN 'physical' THEN 'lucide:Ruler'
  ELSE 'lucide:Info' END;
UPDATE "Attribute" SET "icon" = CASE "key"
  WHEN 'color' THEN 'lucide:Palette' WHEN 'storage' THEN 'lucide:HardDrive' WHEN 'ram' THEN 'lucide:MemoryStick'
  WHEN 'screen-size' THEN 'lucide:Smartphone' WHEN 'refresh-rate' THEN 'lucide:Gauge' WHEN 'panel' THEN 'lucide:MonitorSmartphone'
  WHEN 'processor' THEN 'lucide:Cpu' WHEN 'os' THEN 'lucide:AppWindow' WHEN 'main-camera' THEN 'lucide:Camera'
  WHEN 'front-camera' THEN 'lucide:ScanFace' WHEN 'video' THEN 'lucide:Video' WHEN 'battery' THEN 'lucide:BatteryFull'
  WHEN 'charging' THEN 'lucide:Zap' WHEN 'network' THEN 'lucide:Signal' WHEN 'nfc' THEN 'lucide:Nfc'
  WHEN 'connector' THEN 'lucide:Cable' WHEN 'wattage' THEN 'lucide:PlugZap' WHEN 'compatibility' THEN 'lucide:Link'
  WHEN 'material' THEN 'lucide:Layers' WHEN 'anc' THEN 'lucide:Headphones' WHEN 'water-resistance' THEN 'lucide:Droplets'
  WHEN 'dimensions' THEN 'lucide:Ruler' WHEN 'weight' THEN 'lucide:Weight' WHEN 'capacity' THEN 'lucide:BatteryCharging'
  ELSE NULL END;
