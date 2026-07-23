using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Rheem.Rysnova.RevitPlugin.Models;

namespace Rheem.Rysnova.RevitPlugin.Services
{
    /// <summary>
    /// Rysnova HVAC AI平台API客户端
    /// 提供BIM双向同步、CFD仿真、碰撞检测等服务
    /// </summary>
    public class RysnovaAPIClient
    {
        private readonly HttpClient _client;
        private readonly string _baseUrl;
        private readonly string _apiKey;
        
        public RysnovaAPIClient()
        {
            var settings = PluginSettings.Current;
            _baseUrl = settings.ApiBaseUrl ?? "http://localhost:3000";
            _apiKey = settings.ApiKey;
            
            _client = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
            _client.DefaultRequestHeaders.Accept.Clear();
            _client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            
            if (!string.IsNullOrEmpty(_apiKey))
            {
                _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            }
        }
        
        /// <summary>
        /// 获取项目列表
        /// </summary>
        public List<ProjectSummary> ListProjects()
        {
            var response = GetAsync("/api/rysnova-bim-bim/projects").Result;
            return JsonConvert.DeserializeObject<List<ProjectSummary>>(response);
        }
        
        /// <summary>
        /// 获取项目BIM数据
        /// </summary>
        public BIMProject FetchProject(string projectId)
        {
            var response = GetAsync($"/api/rysnova-bim-bim/projects/{projectId}").Result;
            var wrapper = JsonConvert.DeserializeObject<ApiResponse<BIMProject>>(response);
            return wrapper?.Data;
        }
        
        /// <summary>
        /// 上传完整项目到平台
        /// </summary>
        public UploadResult UploadProject(BIMProject project)
        {
            try
            {
                var response = PostAsync("/api/rysnova-bim-bim/projects/upload", project).Result;
                var wrapper = JsonConvert.DeserializeObject<ApiResponse<UploadResult>>(response);
                return wrapper?.Data ?? new UploadResult { Success = false, ErrorMessage = "无响应" };
            }
            catch (Exception ex)
            {
                return new UploadResult { Success = false, ErrorMessage = ex.Message };
            }
        }
        
        /// <summary>
        /// 增量同步 - 只上传变更
        /// </summary>
        public SyncResult IncrementalSync(string projectId, ChangeSet changes)
        {
            var response = PostAsync($"/api/rysnova-bim-bim/projects/{projectId}/sync", changes).Result;
            var wrapper = JsonConvert.DeserializeObject<ApiResponse<SyncResult>>(response);
            return wrapper?.Data;
        }
        
        /// <summary>
        /// 调用平台BVH碰撞检测
        /// </summary>
        public ClashReport DetectClashes(BIMProject project)
        {
            var payload = new { layout = new { devices = project.Devices, pipes = project.Pipes } };
            var response = PostAsync("/api/rysnova-bim-bim/clash-detection", payload).Result;
            var wrapper = JsonConvert.DeserializeObject<ApiResponse<ClashReport>>(response);
            return wrapper?.Data;
        }
        
        /// <summary>
        /// 调用平台CFD仿真
        /// </summary>
        public CFDResult RunCFDSimulation(BIMProject project, RoomConfig roomConfig)
        {
            var payload = new
            {
                layout = new { devices = project.Devices, pipes = project.Pipes },
                roomConfig = roomConfig
            };
            var response = PostAsync("/api/rysnova-bim-bim/cfd-simulation", payload).Result;
            var wrapper = JsonConvert.DeserializeObject<ApiResponse<CFDResult>>(response);
            return wrapper?.Data;
        }
        
        /// <summary>
        /// 获取工程量统计
        /// </summary>
        public BillOfQuantities GetBOQ(BIMProject project)
        {
            var payload = new { layout = new { devices = project.Devices, pipes = project.Pipes } };
            var response = PostAsync("/api/rysnova-bim-bim/boq", payload).Result;
            var wrapper = JsonConvert.DeserializeObject<ApiResponse<BillOfQuantities>>(response);
            return wrapper?.Data;
        }
        
        // ============== 内部HTTP方法 ==============
        
        private async Task<string> GetAsync(string path)
        {
            var response = await _client.GetAsync(_baseUrl + path);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        }
        
        private async Task<string> PostAsync(string path, object payload)
        {
            var json = JsonConvert.SerializeObject(payload, new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore
            });
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _client.PostAsync(_baseUrl + path, content);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        }
        
        public class ApiResponse<T>
        {
            public bool Success { get; set; }
            public T Data { get; set; }
            public string Message { get; set; }
            public string Error { get; set; }
        }
    }
}
