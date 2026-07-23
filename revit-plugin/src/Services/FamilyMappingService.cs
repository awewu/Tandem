using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Structure;
using Rheem.Rysnova.RevitPlugin.Models;

namespace Rheem.Rysnova.RevitPlugin.Services
{
    /// <summary>
    /// 原生族库映射服务
    /// 将Rysnova设备类型映射到Revit Family，自动加载族文件
    /// </summary>
    public class FamilyMappingService
    {
        private readonly Document _doc;
        private readonly Dictionary<string, FamilyMapping> _mappings;
        
        public FamilyMappingService(Document doc)
        {
            _doc = doc;
            _mappings = LoadMappings();
        }
        
        /// <summary>
        /// 创建Revit族实例（设备）
        /// </summary>
        public FamilyInstance CreateDevice(BIMDevice device)
        {
            // 1. 查找族映射
            if (!_mappings.TryGetValue(device.Type, out var mapping))
            {
                // 使用通用族
                mapping = _mappings["generic"];
            }
            
            // 2. 加载或获取FamilySymbol
            FamilySymbol symbol = GetOrLoadFamilySymbol(mapping);
            if (symbol == null)
            {
                throw new InvalidOperationException(
                    $"无法加载族 {mapping.FamilyName} - {mapping.SymbolName}");
            }
            
            if (!symbol.IsActive) symbol.Activate();
            
            // 3. 计算插入点 (mm -> ft)
            XYZ position = new XYZ(
                device.Position.X / 304.8,
                device.Position.Y / 304.8,
                device.Position.Z / 304.8
            );
            
            // 4. 获取标高
            Level level = GetNearestLevel(position.Z);
            
            // 5. 创建族实例
            FamilyInstance instance;
            if (mapping.IsHosted)
            {
                instance = _doc.Create.NewFamilyInstance(
                    position, symbol, level, StructuralType.NonStructural);
            }
            else
            {
                instance = _doc.Create.NewFamilyInstance(
                    position, symbol, StructuralType.NonStructural);
            }
            
            return instance;
        }
        
        /// <summary>
        /// Rysnova设备类型 -> Revit族 映射表
        /// </summary>
        private Dictionary<string, FamilyMapping> LoadMappings()
        {
            return new Dictionary<string, FamilyMapping>(StringComparer.OrdinalIgnoreCase)
            {
                // 空调系统
                ["ac-outdoor"] = new FamilyMapping
                {
                    FamilyName = "Rheem_AC_Outdoor",
                    SymbolName = "RH-OD120",
                    Category = BuiltInCategory.OST_MechanicalEquipment,
                    FamilyFile = "Rheem_AC_Outdoor.rfa",
                    IsHosted = false
                },
                ["ac-indoor"] = new FamilyMapping
                {
                    FamilyName = "Rheem_AC_Indoor_Duct",
                    SymbolName = "RHI-25T",
                    Category = BuiltInCategory.OST_MechanicalEquipment,
                    FamilyFile = "Rheem_AC_Indoor.rfa",
                    IsHosted = true
                },
                
                // 采暖系统
                ["heating-boiler"] = new FamilyMapping
                {
                    FamilyName = "Rheem_Boiler_WallHung",
                    SymbolName = "RH-B24",
                    Category = BuiltInCategory.OST_MechanicalEquipment,
                    FamilyFile = "Rheem_Boiler.rfa",
                    IsHosted = true
                },
                ["heating-manifold"] = new FamilyMapping
                {
                    FamilyName = "Rheem_Manifold",
                    SymbolName = "RH-MF8",
                    Category = BuiltInCategory.OST_PipeAccessory,
                    FamilyFile = "Rheem_Manifold.rfa",
                    IsHosted = false
                },
                
                // 热水系统
                ["water-heater"] = new FamilyMapping
                {
                    FamilyName = "Rheem_WaterHeater",
                    SymbolName = "RGE-80",
                    Category = BuiltInCategory.OST_PlumbingFixtures,
                    FamilyFile = "Rheem_WaterHeater.rfa",
                    IsHosted = false
                },
                ["water-pump"] = new FamilyMapping
                {
                    FamilyName = "Rheem_Pump",
                    SymbolName = "WP-RS25",
                    Category = BuiltInCategory.OST_MechanicalEquipment,
                    FamilyFile = "Rheem_Pump.rfa",
                    IsHosted = false
                },
                ["water-tank"] = new FamilyMapping
                {
                    FamilyName = "Rheem_WaterTank",
                    SymbolName = "TANK-100L",
                    Category = BuiltInCategory.OST_PlumbingFixtures,
                    FamilyFile = "Rheem_Tank.rfa",
                    IsHosted = false
                },
                
                // 新风系统
                ["fresh-unit"] = new FamilyMapping
                {
                    FamilyName = "Rheem_FreshAir_Unit",
                    SymbolName = "FRESH-350",
                    Category = BuiltInCategory.OST_MechanicalEquipment,
                    FamilyFile = "Rheem_FreshAir.rfa",
                    IsHosted = true
                },
                ["fresh-outlet"] = new FamilyMapping
                {
                    FamilyName = "Rheem_FreshAir_Outlet",
                    SymbolName = "Outlet-200",
                    Category = BuiltInCategory.OST_DuctTerminal,
                    FamilyFile = "Rheem_Outlet.rfa",
                    IsHosted = true
                },
                
                // 组件
                ["comp-silencer"] = new FamilyMapping
                {
                    FamilyName = "Rheem_Silencer",
                    Category = BuiltInCategory.OST_DuctAccessory,
                    FamilyFile = "Rheem_Silencer.rfa"
                },
                ["comp-damper"] = new FamilyMapping
                {
                    FamilyName = "Rheem_Damper",
                    Category = BuiltInCategory.OST_DuctAccessory,
                    FamilyFile = "Rheem_Damper.rfa"
                },
                ["comp-filter"] = new FamilyMapping
                {
                    FamilyName = "Rheem_Filter",
                    Category = BuiltInCategory.OST_DuctAccessory,
                    FamilyFile = "Rheem_Filter.rfa"
                },
                
                // 通用兜底
                ["generic"] = new FamilyMapping
                {
                    FamilyName = "M_Generic Model",
                    Category = BuiltInCategory.OST_GenericModel,
                    FamilyFile = null  // 使用Revit自带
                }
            };
        }
        
        private FamilySymbol GetOrLoadFamilySymbol(FamilyMapping mapping)
        {
            // 1. 在文档中查找已加载的族
            var existingSymbol = new FilteredElementCollector(_doc)
                .OfClass(typeof(FamilySymbol))
                .Cast<FamilySymbol>()
                .FirstOrDefault(s => 
                    s.Family.Name == mapping.FamilyName &&
                    (string.IsNullOrEmpty(mapping.SymbolName) || s.Name == mapping.SymbolName));
            
            if (existingSymbol != null) return existingSymbol;
            
            // 2. 从族库文件加载
            if (!string.IsNullOrEmpty(mapping.FamilyFile))
            {
                string libraryPath = Path.Combine(
                    PluginSettings.Current.FamilyLibraryPath ?? GetDefaultLibraryPath(),
                    mapping.FamilyFile
                );
                
                if (File.Exists(libraryPath))
                {
                    Family family;
                    if (_doc.LoadFamily(libraryPath, out family))
                    {
                        var symbol = family.GetFamilySymbolIds()
                            .Select(id => _doc.GetElement(id) as FamilySymbol)
                            .FirstOrDefault();
                        return symbol;
                    }
                }
            }
            
            // 3. 兜底：使用项目中的第一个相同类别族
            return new FilteredElementCollector(_doc)
                .OfClass(typeof(FamilySymbol))
                .OfCategory(mapping.Category)
                .Cast<FamilySymbol>()
                .FirstOrDefault();
        }
        
        private Level GetNearestLevel(double z)
        {
            var levels = new FilteredElementCollector(_doc)
                .OfClass(typeof(Level))
                .Cast<Level>()
                .OrderBy(l => Math.Abs(l.Elevation - z))
                .FirstOrDefault();
            
            return levels;
        }
        
        private string GetDefaultLibraryPath()
        {
            string assemblyDir = Path.GetDirectoryName(
                System.Reflection.Assembly.GetExecutingAssembly().Location);
            return Path.Combine(assemblyDir, "FamilyLibrary");
        }
        
        public class FamilyMapping
        {
            public string FamilyName { get; set; }
            public string SymbolName { get; set; }
            public BuiltInCategory Category { get; set; }
            public string FamilyFile { get; set; }
            public bool IsHosted { get; set; }
        }
    }
}
