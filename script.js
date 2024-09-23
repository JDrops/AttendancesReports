const generateDateRange = (startDate, endDate) => {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        dates.push(`${day}-${month}`);
    }

    return dates;
};

const periodeAwal = '2024-08-21';
const periodeAkhir = '2024-09-20';

function formatDate(dateString) {
    const options = { day: '2-digit', month: 'long', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

$('#periode').append(`${formatDate(periodeAwal)} - ${formatDate(periodeAkhir)}`);

const predefinedDates = generateDateRange(periodeAwal, periodeAkhir);

const renderTable = (department, data) => {
    $('#attendance-table thead tr').empty();
    $('#attendance-table tbody').empty();
    $('#color-counts-table tbody').empty();

    $('#attendance-table thead tr').append('<th>NAMA</th>');
    predefinedDates.forEach(date => {
        $('#attendance-table thead tr').append(`<th>${date}</th>`);
    });

    const attendanceMap = {};
    const colorCountsMap = {};

    data.forEach(entry => {
        if (entry.Departemen === department) {
            if (!entry.Waktu || !entry.Status) return;

            const date = entry.Waktu.split(' ')[0];
            const time = entry.Waktu.split(' ')[1];
            const status = entry.Status;
            const statusBaru = entry.StatusBaru;
            const pengecualian = entry.Pengecualian;

            const [day, month] = date.split('-');
            const formattedDate = `${day}-${month}`;

            if (!attendanceMap[entry.Nama]) {
                attendanceMap[entry.Nama] = {};
                colorCountsMap[entry.Nama] = { red: 0, orange: 0, green: 0, blue: 0 };
            }

            if (!attendanceMap[entry.Nama][formattedDate]) {
                attendanceMap[entry.Nama][formattedDate] = { clockIn: '-', clockOut: '-' };
            }

            if (status === 'C/Masuk' && pengecualian === "OK") {
                const clockInTime = new Date(`1970-01-01T0${time}:00`);
                const clockInLimit = new Date(`1970-01-01T11:59:00`);
                if (clockInTime <= clockInLimit) {
                    attendanceMap[entry.Nama][formattedDate].clockIn = time;
                }
            } else if (pengecualian === "OK" && (status === "C/Keluar")) {
                attendanceMap[entry.Nama][formattedDate].clockOut = time;
            }
            if (pengecualian === "OK" && (status === "C/Masuk" && statusBaru === "C/Keluar")) {
                attendanceMap[entry.Nama][formattedDate].clockOut = time;
            }
        }
    });

    // Render the attendance table
    for (const [name, dates] of Object.entries(attendanceMap)) {
        const row = `<tr><td>${name}</td>${predefinedDates.map(date => {
            const { clockIn, clockOut } = dates[date] || { clockIn: '-', clockOut: '-' };
            let cellClass = '';

            if (clockIn === '-' && clockOut === '-') {
                cellClass = 'no-data';
                colorCountsMap[name].red++;
            } else if (clockIn === '-' || clockOut === '-') {
                cellClass = 'partial-data';
                colorCountsMap[name].orange++;
            } else {
                const clockInTime = new Date(`1970-01-01T0${clockIn}:00`);
                const lateThreshold1 = new Date('1970-01-01T08:16:00');
                const lateThreshold2 = new Date('1970-01-01T08:31:00');

                if (clockInTime >= lateThreshold1 && clockInTime < lateThreshold2) {
                    cellClass = 'on-time-late';
                    colorCountsMap[name].green++;
                } else if (clockInTime >= lateThreshold2) {
                    cellClass = 'very-late';
                    colorCountsMap[name].blue++;
                }
            }

            return `<td class="${cellClass}">${clockIn === '-' && clockOut === '-' ? '-' : `${clockIn}<br>${clockOut}`}</td>`;
        }).join('')}</tr>`;
        
        $('#attendance-table tbody').append(row);
    }

    // Render the color counts table
    for (const [name, counts] of Object.entries(colorCountsMap)) {
        const libur = 5;
        const hariKerja = 31;
        const uangMakan = department === "ADMIN" || department === "GUDANG" ? 20000 : 25000;
        const potongan = 5000 * counts.green + uangMakan * (counts.orange + counts.blue + counts.red - libur);
        const grandTotal = (hariKerja - libur) * uangMakan - potongan;
        
        const row = `
            <tr>
                <td>${department}</td>
                <td>${name}</td>
                <td>${counts.red - libur === 0 ? '-' : counts.red - libur}</td>
                <td>${counts.orange === 0 ? '-' : counts.orange}</td>
                <td>${counts.green === 0 ? '-' : counts.green}</td>
                <td>${counts.blue === 0 ? '-' : counts.blue}</td>
                <td>${hariKerja - counts.red}</td>
                <td>${potongan > 0 ? `Rp. ${potongan.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}` : '-'}</td>
                <td>${grandTotal > 0 ? `Rp. ${grandTotal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}` : '-'}</td>
                <td></td>
            </tr>`;
        
        $('#color-counts-table tbody').append(row);
    }
};

const processCSV = (csvText) => {
    const rows = csvText.split('\n').slice(1);
    return rows.map(row => {
        const [Departemen, Nama, ID, Waktu, Status, StatusBaru, Pengecualian] = row.split(';').map(item => item.replace(/"/g, '').trim());
        return { Departemen, Nama, ID, Waktu, Status, StatusBaru, Pengecualian };
    });
};

const handleFileUpload = () => {
    const fileInput = $('#file-upload')[0];
    const file = fileInput.files[0];
    $('#first-page').hide();

    if (file) {
        const reader = new FileReader();
        $('#loading').show(); // Show loading
        reader.onload = (e) => {
            const csvText = e.target.result;
            const data = processCSV(csvText);
            populateDepartments(data);

            const selectedDepartment = $('#department-selector').val();
            if (selectedDepartment) {
                renderTable(selectedDepartment, data);
            }

            $('#loading').hide(); // Hide loading
            toggleResult();
        };
        reader.readAsText(file);
    }
};

const populateDepartments = (data) => {
    // const departments = [...new Set(data.map(entry => entry.Departemen))];
    const departments = [...new Set(data.map(entry => entry.Departemen.trim()).filter(department => department !== ""))]; // Filter out empty strings
    const sortedDepartments = departments.sort();
    const selector = $('#department-selector');

    selector.empty();
    // selector.append('<option value="">-- Select Department --</option>');
    sortedDepartments.forEach(department => {
        selector.append(`<option value="${department}">${department}</option>`);
    });

    // Enable change event after populating departments
    $('#department-selector').change(function() {
        const selectedDepartment = $(this).val();
        renderTable(selectedDepartment, data);
    });

};

$(document).ready(function() {
    $('#file-upload').on('change', function() {
        $('#upload-button').prop('disabled', !this.files.length);
    });
    $('#upload-button').on('click', handleFileUpload);
    $('#close').on('click', function() {
        location.reload();
    });
});

function toggleResult() {
    $('#second-page').toggle();
}