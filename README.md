# DevSecOps Lab: CI/CD Pipeline Security

Lab thực hành nhúng bảo mật vào pipeline CI/CD bằng GitHub Actions. App trong
thư mục `app/` **cố tình** chứa 3 lỗ hổng khác nhau, mỗi lỗ hổng đại diện cho
một hạng mục kiểm tra bảo mật phổ biến nhất trong DevSecOps:

| Lỗ hổng | Vị trí | Loại kiểm tra | Công cụ |
|---|---|---|---|
| Secret hardcode trong code | `app/server.js` (`STRIPE_API_KEY`) | Secrets scanning | [Gitleaks](https://github.com/gitleaks/gitleaks) |
| SQL Injection (CWE-89) | `app/server.js` (`GET /search`) | SAST | [Semgrep](https://semgrep.dev/) |
| Dependency cũ có CVE đã biết | `app/package.json` (`lodash@4.17.15`) | SCA (dependency scanning) | [OSV-Scanner](https://google.github.io/osv-scanner/) + `npm audit` |

**Không deploy app này ở đâu thật** — nó chỉ để pipeline quét và học, không có
mục đích sử dụng khác.

## Cách pipeline hoạt động

File `.github/workflows/devsecops-pipeline.yml` định nghĩa 3 job chạy song
song mỗi khi push/mở PR vào nhánh `main`:

1. **secrets-scan** — Gitleaks quét toàn bộ repo tìm secret bị commit nhầm.
2. **sast** — Semgrep quét code trong `app/` với ruleset OWASP Top 10 +
   security-audit, tìm các lỗi như SQL injection, XSS, command injection...
3. **sca** — cài dependency, dùng OSV-Scanner quét `package-lock.json` để tìm
   CVE đã biết trong OSV.dev; OSV-Scanner tự thoát với mã lỗi khi tìm thấy lỗ
   hổng, đó chính là bước "gate" của job này (bạn có thể chạy thêm
   `npm audit` cục bộ để đối chiếu nhanh).

Mỗi job đều theo cùng một pattern:
`scan (không fail ngay) → upload kết quả dạng SARIF lên GitHub Security →
sau đó mới fail job nếu có finding`. Lý do tách ra hai bước là để **kết quả
luôn được ghi lại** kể cả khi build fail — không mất thông tin.

## Chạy thử

1. **Cài đặt local** (không bắt buộc, chỉ để kiểm tra app chạy được):
   ```
   cd app
   npm install
   node server.js
   ```
   Mở `http://localhost:3000/` — thấy `{"status":"ok",...}` là app chạy tốt.
   (Gọi `/search` sẽ trả lỗi 500 vì không có Postgres thật — bình thường,
   pipeline chỉ phân tích tĩnh code chứ không cần app thực sự chạy.)

2. **Đẩy lên GitHub để pipeline chạy thật**:
   ```
   git init
   git add .
   git commit -m "Add DevSecOps lab"
   gh repo create devsecops-lab --private --source=. --push
   ```
   Sau đó vào tab **Actions** trên GitHub để xem pipeline chạy, và tab
   **Security → Code scanning alerts** để xem kết quả Gitleaks/Semgrep/
   OSV-Scanner tổng hợp.

3. **Kỳ vọng**: cả 3 job đều **fail** ở lần chạy đầu tiên — đúng như thiết kế,
   vì cả 3 lỗ hổng đều còn nguyên.

## Bài tập: tự sửa lỗi (remediation)

Sau khi thấy pipeline fail và đọc finding trong tab Security, hãy tự sửa và
push lại để xem pipeline chuyển sang pass:

1. **Secret**: xoá `STRIPE_API_KEY` khỏi code, chuyển sang đọc từ biến môi
   trường (`process.env.STRIPE_API_KEY`) và set giá trị đó qua
   **GitHub Secrets**, không commit vào repo. Nhớ coi key cũ như đã bị lộ —
   trong thực tế phải revoke/rotate nó.
2. **SQL Injection**: sửa câu query trong `/search` sang dùng
   **parameterized query**:
   ```js
   const result = await pool.query(
     'SELECT id, name FROM products WHERE name = $1',
     [term]
   );
   ```
3. **Dependency cũ**: nâng cấp lodash lên bản đã vá:
   ```
   npm install lodash@latest --save-exact
   ```
   (hoặc bất kỳ bản >= 4.17.21).

Push lại từng thay đổi (hoặc gộp một lần) và xác nhận cả 3 job trong tab
Actions chuyển xanh.

## Vì sao thiết kế theo cách này

- **Không cần API key/tài khoản trả phí nào** ngoài GitHub — Gitleaks,
  Semgrep (chạy CLI, không dùng Semgrep Cloud), và OSV-Scanner đều free và
  chạy độc lập.
- **Kết quả tập trung ở tab Security** (định dạng SARIF chuẩn) thay vì chỉ
  nằm rải rác trong log — đúng trải nghiệm DevSecOps thật, nơi security
  finding được theo dõi như một hạng mục riêng, không lẫn vào log build.
- **Gate tách khỏi scan**: nếu gộp chung (fail ngay khi scan phát hiện lỗi),
  bước upload SARIF phía sau sẽ không bao giờ chạy khi có lỗi — mất hết
  visibility đúng lúc cần nhất.
