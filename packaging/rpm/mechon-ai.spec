Name:           mechon-ai
Version:        1.0.0
Release:        1%{?dist}
Summary:        Native desktop workstation for SFT and DPO dataset engineering

License:        Apache-2.0
URL:            https://github.com/Mechon-AI/mechon-ai
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  cargo, rust, nodejs, npm, webkit2gtk4.1-devel, gtk3-devel
Requires:       webkit2gtk4.1, gtk3, python3 >= 3.11, sqlite

%description
Mechon AI is an offline-first desktop workstation for creating,
curating, validating, and exporting high-grade training datasets for SFT and DPO
alignment workflows.

%prep
%autosetup

%build
cd frontend && npm run build && cd ..
cd src-tauri && cargo build --release && cd ..

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}%{_bindir}
mkdir -p %{buildroot}%{_datadir}/applications
mkdir -p %{buildroot}%{_datadir}/icons/hicolor/512x512/apps

install -m 755 src-tauri/target/release/mechon-ai %{buildroot}%{_bindir}/
install -m 644 packaging/arch/mechon-ai.desktop %{buildroot}%{_datadir}/applications/
install -m 644 src-tauri/icons/icon.png %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/mechon-ai.png

%files
%{_bindir}/mechon-ai
%{_datadir}/applications/mechon-ai.desktop
%{_datadir}/icons/hicolor/512x512/apps/mechon-ai.png

%changelog
* Sun Nov 02 2026 Mechon AI Team <team@mechon.ai> - 1.0.0-1
- Official initial release of Mechon AI
